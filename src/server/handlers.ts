import { HttpResponse, delay, http } from 'msw';
import { describeError } from '@/domain/errors';
import {
  API_BASE,
  correctionsSchema,
  createBatchSchema,
  uploadFileSchema,
  fromSearchParams,
  retryBatchSchema,
  type ApiError,
  type ArchiveAnalytics,
  type ArchiveSummary,
  type ManualEntryResult,
  type RetryResult,
} from './api-contract';
import { analyzeArchive } from './corpus/analytics';
import { indexFromId, detailAt, summaryAt } from './corpus/documentAt';
import { countByStatus, queryDocuments } from './corpus/query';
import {
  advanceAll,
  batchFor,
  correctDocument,
  failedIn,
  getDatabase,
  reprocess,
  retryDocuments,
  selectRetryable,
  sendToManualEntry,
  startBatch,
} from './db';
import { summarizeBatch } from './simulator/batch';

/**
 * Matched with a wildcard origin so the same handlers serve the browser, where
 * requests are same-origin and relative, and Node tests, where fetch requires an
 * absolute URL.
 */
const ROUTE = `*${API_BASE}`;

function fail(status: number, error: ApiError) {
  return HttpResponse.json(error, { status });
}

const notFound = (what: string) =>
  fail(404, { code: 'not_found', message: `${what} could not be found.` });

// Resolves a route parameter into a document index the archive actually holds.
function resolveIndex(id: string | readonly string[] | undefined): number | null {
  if (typeof id !== 'string') return null;

  const db = getDatabase();
  const index = indexFromId(id);

  return index !== null && index < db.store.size ? index : null;
}

export const handlers = [
  http.get(`${ROUTE}/summary`, async () => {
    const db = getDatabase();
    await delay(db.latency.read);

    advanceAll(db);

    const summary: ArchiveSummary = {
      total: db.store.size,
      byStatus: countByStatus(db.store, db.overlay),
    };

    return HttpResponse.json(summary);
  }),

  http.get(`${ROUTE}/analytics`, async () => {
    const db = getDatabase();
    await delay(db.latency.read);

    advanceAll(db);

    return HttpResponse.json(analyzeArchive(db.store, db.overlay) satisfies ArchiveAnalytics);
  }),

  http.get(`${ROUTE}/documents`, async ({ request }) => {
    const db = getDatabase();
    await delay(db.latency.read);

    advanceAll(db);

    const query = fromSearchParams(new URL(request.url).searchParams);

    return HttpResponse.json(queryDocuments(db.store, db.overlay, query));
  }),

  http.get(`${ROUTE}/documents/:id`, async ({ params }) => {
    const db = getDatabase();
    await delay(db.latency.read);

    advanceAll(db);

    const index = resolveIndex(params.id);
    if (index === null) return notFound('That document');

    return HttpResponse.json(detailAt(db.store, db.overlay, index));
  }),

  http.patch(`${ROUTE}/documents/:id`, async ({ params, request }) => {
    const db = getDatabase();
    await delay(db.latency.write);

    const index = resolveIndex(params.id);
    if (index === null) return notFound('That document');

    const parsed = correctionsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(400, {
        code: 'invalid_request',
        message: 'That correction could not be read.',
        remedy: 'Send at least one field and value.',
      });
    }

    for (const { field, value } of parsed.data.corrections) {
      correctDocument(db, index, field, value);
    }

    return HttpResponse.json(detailAt(db.store, db.overlay, index));
  }),

  http.post(`${ROUTE}/documents/:id/retry`, async ({ params }) => {
    const db = getDatabase();
    await delay(db.latency.write);

    const index = resolveIndex(params.id);
    if (index === null) return notFound('That document');

    const summary = summaryAt(db.store, db.overlay, index);

    if (summary.status !== 'failed' || summary.errorCode === undefined) {
      return fail(409, {
        code: 'not_retryable',
        message: 'That document has not failed, so there is nothing to retry.',
      });
    }

    const { errorCode } = summary;
    const { retryable } = selectRetryable(db, [index]);

    if (retryable.length === 0) {
      const spec = describeError(errorCode);
      return fail(409, {
        code: 'not_retryable',
        message: spec.title,
        remedy: spec.remedy,
      });
    }

    // The archive's own failures belong to no upload. They are reprocessed
    // rather than refused, or every failure not from this session would carry a
    // retry button that could never work.
    const batch = batchFor(db, index);
    if (batch === undefined) reprocess(db, retryable);
    else retryDocuments(db, batch, retryable);

    return HttpResponse.json({ retried: retryable.length, skipped: 0 } satisfies RetryResult);
  }),

  /**
   * Hands one failure to an operator instead of retrying it.
   *
   * Refused for failures a retry could still clear: an operator's time is the
   * expensive resource, and spending it on something the pipeline would fix by
   * itself is the wrong trade.
   */
  http.post(`${ROUTE}/documents/:id/manual-entry`, async ({ params }) => {
    const db = getDatabase();
    await delay(db.latency.write);

    const index = resolveIndex(params.id);
    if (index === null) return notFound('That document');

    const { moved, skipped } = sendToManualEntry(db, [index]);

    if (moved === 0) {
      return fail(409, {
        code: 'not_retryable',
        message: 'That document is not waiting on manual entry.',
        remedy: 'Only a failure that cannot be retried can be entered by hand.',
      });
    }

    return HttpResponse.json({ moved, skipped } satisfies ManualEntryResult);
  }),

  /**
   * Accepts one file. Fails transiently at the configured rate so the queue's
   * backoff and retry are exercised by something real rather than simulated in
   * the client, and so the network tab shows what actually happened.
   */
  http.post(`${ROUTE}/uploads`, async ({ request }) => {
    const db = getDatabase();
    await delay(db.latency.write);

    const parsed = uploadFileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(400, {
        code: 'invalid_request',
        message: 'That file could not be read.',
        remedy: 'Check the file and try again.',
      });
    }

    if (Math.random() < db.config.uploadFailureRate) {
      return fail(503, {
        code: 'server_error',
        message: 'The upload service was briefly unavailable.',
        remedy: 'This usually clears on its own.',
      });
    }

    return HttpResponse.json({ accepted: true });
  }),

  http.get(`${ROUTE}/batches`, async () => {
    const db = getDatabase();
    await delay(db.latency.read);

    advanceAll(db);
    const now = Date.now();

    const summaries = [...db.batches.values()]
      .map((batch) => summarizeBatch(db.store, db.overlay, batch, now))
      .sort((a, b) => b.createdAt - a.createdAt);

    return HttpResponse.json(summaries);
  }),

  http.post(`${ROUTE}/batches`, async ({ request }) => {
    const db = getDatabase();
    await delay(db.latency.write);

    const parsed = createBatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(400, {
        code: 'invalid_request',
        message: 'That upload could not be read.',
        remedy: 'A batch needs a label and at least one file.',
      });
    }

    try {
      const batch = startBatch(db, parsed.data.label, parsed.data.fileCount);
      return HttpResponse.json(summarizeBatch(db.store, db.overlay, batch, Date.now()), {
        status: 201,
      });
    } catch {
      return fail(507, {
        code: 'server_error',
        message: 'The archive has no room for that many more documents.',
        remedy: 'Reload to start a fresh archive, or upload a smaller batch.',
      });
    }
  }),

  http.get(`${ROUTE}/batches/:id`, async ({ params }) => {
    const db = getDatabase();
    await delay(db.latency.read);

    advanceAll(db);

    const batch = typeof params.id === 'string' ? db.batches.get(params.id) : undefined;
    if (batch === undefined) return notFound('That batch');

    return HttpResponse.json(summarizeBatch(db.store, db.overlay, batch, Date.now()));
  }),

  http.post(`${ROUTE}/batches/:id/retry`, async ({ params, request }) => {
    const db = getDatabase();
    await delay(db.latency.write);

    advanceAll(db);

    const batch = typeof params.id === 'string' ? db.batches.get(params.id) : undefined;
    if (batch === undefined) return notFound('That batch');

    const parsed = retryBatchSchema.safeParse(await request.json().catch(() => ({})));
    const requested =
      parsed.success && parsed.data.indices ? parsed.data.indices : failedIn(db, batch);

    const { retryable, skipped } = selectRetryable(db, requested);
    retryDocuments(db, batch, retryable);

    return HttpResponse.json({ retried: retryable.length, skipped } satisfies RetryResult);
  }),

  // Hands every failure in a batch that a retry cannot clear to an operator.
  http.post(`${ROUTE}/batches/:id/manual-entry`, async ({ params }) => {
    const db = getDatabase();
    await delay(db.latency.write);

    advanceAll(db);

    const batch = typeof params.id === 'string' ? db.batches.get(params.id) : undefined;
    if (batch === undefined) return notFound('That batch');

    return HttpResponse.json(
      sendToManualEntry(db, failedIn(db, batch)) satisfies ManualEntryResult,
    );
  }),
];
