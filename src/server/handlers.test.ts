import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DocumentDetail, DocumentSummary } from '@/domain/document';
import { isRetryable } from '@/domain/errors';
import type {
  ApiError,
  ArchiveAnalytics,
  ArchiveSummary,
  ManualEntryResult,
  RetryResult,
} from './api-contract';
import { resetDatabase } from './db';
import { server } from './node';
import type { BatchSummary } from './simulator/batch';
import type { QueryResult } from './corpus/query';

const BASE = 'http://localhost/api';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * A small archive with no artificial latency and a fast simulator. Latency and
 * service time are demo affordances, not part of the contract — leaving them in
 * would mean waiting out the demo pacing on every assertion.
 */
beforeEach(() =>
  resetDatabase({
    size: 400,
    latency: { read: 0, write: 0 },
    config: { concurrency: 40, serviceTimeMs: 5 },
  }),
);

async function get<T>(path: string): Promise<{ status: number; body: T }> {
  const response = await fetch(`${BASE}${path}`);
  return { status: response.status, body: (await response.json()) as T };
}

async function send<T>(
  method: 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { status: response.status, body: (await response.json()) as T };
}

// Polls the batch endpoint the way the client will, until it settles.
async function drainBatch(id: string, maxPolls = 200): Promise<BatchSummary> {
  for (let poll = 0; poll < maxPolls; poll += 1) {
    const { body } = await get<BatchSummary>(`/batches/${id}`);
    if (body.settled) return body;
  }

  throw new Error('Batch never settled');
}

describe('GET /summary', () => {
  it('reports the archive size and a full status breakdown', async () => {
    const { status, body } = await get<ArchiveSummary>('/summary');

    expect(status).toBe(200);
    expect(body.total).toBe(400);
    expect(Object.values(body.byStatus).reduce((sum, value) => sum + value, 0)).toBe(400);
  });
});

describe('GET /documents', () => {
  it('returns a page with paging metadata', async () => {
    const { status, body } = await get<QueryResult>('/documents?pageSize=25');

    expect(status).toBe(200);
    expect(body.rows).toHaveLength(25);
    expect(body.total).toBe(400);
    expect(body.pageCount).toBe(16);
  });

  it('applies filters from the query string', async () => {
    const { body } = await get<QueryResult>('/documents?status=failed&pageSize=50');

    expect(body.rows.length).toBeGreaterThan(0);
    for (const row of body.rows) expect(row.status).toBe('failed');
  });

  it('accepts repeated parameters as a union', async () => {
    const { body } = await get<QueryResult>('/documents?status=failed&status=needs_review');
    const failed = await get<QueryResult>('/documents?status=failed');
    const review = await get<QueryResult>('/documents?status=needs_review');

    expect(body.total).toBe(failed.body.total + review.body.total);
  });

  it('sorts as asked', async () => {
    const { body } = await get<QueryResult>('/documents?sort=uploadedAt&dir=asc&pageSize=20');

    for (let i = 1; i < body.rows.length; i += 1) {
      const previous = body.rows[i - 1] as DocumentSummary;
      expect((body.rows[i] as DocumentSummary).uploadedAt).toBeGreaterThanOrEqual(
        previous.uploadedAt,
      );
    }
  });

  it('ignores malformed parameters rather than failing the request', async () => {
    const { status, body } = await get<QueryResult>(
      '/documents?status=banana&sort=nonsense&page=-4&pageSize=abc',
    );

    expect(status).toBe(200);
    expect(body.total).toBe(400);
  });
});

describe('GET /documents/:id', () => {
  it('returns the full record', async () => {
    const { status, body } = await get<DocumentDetail>('/documents/ARC-000012');

    expect(status).toBe(200);
    expect(body.id).toBe('ARC-000012');
    expect(body.fields.personName).toBeDefined();
    expect(body.corrections).toEqual([]);
  });

  it('is a 404 for an index beyond the archive', async () => {
    const { status, body } = await get<ApiError>('/documents/ARC-999999');

    expect(status).toBe(404);
    expect(body.code).toBe('not_found');
  });

  it('is a 404 for an identifier that is not ours', async () => {
    expect((await get<ApiError>('/documents/not-an-id')).status).toBe(404);
  });
});

describe('PATCH /documents/:id', () => {
  async function findNeedsReview(): Promise<DocumentSummary> {
    const { body } = await get<QueryResult>('/documents?status=needs_review&pageSize=1');
    const row = body.rows[0];
    if (!row) throw new Error('No document needs review');
    return row;
  }

  it('records the corrected value as operator-sourced', async () => {
    const target = await findNeedsReview();
    const { status, body } = await send<DocumentDetail>('PATCH', `/documents/${target.id}`, {
      corrections: [{ field: 'personName', value: 'Corrected Name' }],
    });

    expect(status).toBe(200);
    expect(body.fields.personName.value).toBe('Corrected Name');
    expect(body.fields.personName.source).toBe('manual');
    expect(body.fields.personName.confidence).toBe(1);
  });

  it('appends to the audit trail', async () => {
    const target = await findNeedsReview();
    await send('PATCH', `/documents/${target.id}`, {
      corrections: [{ field: 'personName', value: 'One' }],
    });
    const { body } = await send<DocumentDetail>('PATCH', `/documents/${target.id}`, {
      corrections: [{ field: 'phone', value: '+8801700000000' }],
    });

    expect(body.corrections).toHaveLength(2);
    expect(body.corrections[0]?.field).toBe('personName');
  });

  it('persists across a subsequent read', async () => {
    const target = await findNeedsReview();
    await send('PATCH', `/documents/${target.id}`, {
      corrections: [{ field: 'location', value: 'Dhaka' }],
    });

    const { body } = await get<DocumentDetail>(`/documents/${target.id}`);
    expect(body.fields.location.value).toBe('Dhaka');
  });

  it('rejects an unknown field', async () => {
    const target = await findNeedsReview();
    const { status, body } = await send<ApiError>('PATCH', `/documents/${target.id}`, {
      corrections: [{ field: 'notAField', value: 'x' }],
    });

    expect(status).toBe(400);
    expect(body.code).toBe('invalid_request');
  });

  it('applies a whole pass over a record in one request', async () => {
    const target = await findNeedsReview();
    const { body } = await send<DocumentDetail>('PATCH', `/documents/${target.id}`, {
      corrections: [
        { field: 'personName', value: 'Rehana Sarker' },
        { field: 'location', value: 'Sylhet Sadar' },
        { field: 'phone', value: '+8801700000000' },
      ],
    });

    expect(body.fields.personName.value).toBe('Rehana Sarker');
    expect(body.fields.location.value).toBe('Sylhet Sadar');
    expect(body.corrections).toHaveLength(3);
  });

  it('rejects a correction the form would not have allowed', async () => {
    // The form is where an operator meets these rules, but a backend that takes
    // whatever reaches it is trusting the client rather than validating.
    const target = await findNeedsReview();

    for (const correction of [
      { field: 'phone', value: '+8801012345678' },
      { field: 'documentDate', value: '2099-01-01' },
    ]) {
      const { status, body } = await send<ApiError>('PATCH', `/documents/${target.id}`, {
        corrections: [correction],
      });

      expect(status, `${correction.field} was accepted`).toBe(400);
      expect(body.code).toBe('invalid_request');
    }
  });

  it('rejects a pass with no corrections in it', async () => {
    const target = await findNeedsReview();
    const { status } = await send('PATCH', `/documents/${target.id}`, { corrections: [] });

    expect(status).toBe(400);
  });

  it('takes a corrected document out of the review queue', async () => {
    const target = await findNeedsReview();
    const detail = await get<DocumentDetail>(`/documents/${target.id}`);

    // Every uncertain field answered, so there is nothing left to check. Each
    // answer has to be valid for its own field: the phone and the date are
    // checked against the same rules the correction form applies, so one filler
    // string for all five is rejected before anything is applied.
    const answers: Record<string, string> = {
      phone: '+8801700000000',
      documentDate: '2024-03-18',
    };

    const corrections = Object.entries(detail.body.fields)
      .filter(([, field]) => field.source !== 'manual' && field.confidence < 0.7)
      .map(([field]) => ({ field, value: answers[field] ?? 'Checked by hand' }));

    expect(corrections.length).toBeGreaterThan(0);

    const { body } = await send<DocumentDetail>('PATCH', `/documents/${target.id}`, {
      corrections,
    });

    expect(body.status).toBe('completed');
  });

  it('is a 404 for a document that does not exist', async () => {
    const { status } = await send('PATCH', '/documents/ARC-999999', {
      corrections: [{ field: 'personName', value: 'x' }],
    });

    expect(status).toBe(404);
  });
});

describe('POST /batches', () => {
  it('creates a batch with everything queued', async () => {
    const { status, body } = await send<BatchSummary>('POST', '/batches', {
      label: 'Field intake',
      fileCount: 40,
    });

    expect(status).toBe(201);
    expect(body.total).toBe(40);
    expect(body.counts.pending).toBe(40);
    expect(body.settled).toBe(false);
  });

  it('grows the archive by the number of files', async () => {
    await send('POST', '/batches', { label: 'Intake', fileCount: 30 });

    expect((await get<ArchiveSummary>('/summary')).body.total).toBe(430);
  });

  it('rejects a batch with no files', async () => {
    const { status, body } = await send<ApiError>('POST', '/batches', {
      label: 'Empty',
      fileCount: 0,
    });

    expect(status).toBe(400);
    expect(body.code).toBe('invalid_request');
    expect(body.remedy).toBeDefined();
  });

  it('rejects a batch with no label', async () => {
    expect((await send('POST', '/batches', { label: '', fileCount: 5 })).status).toBe(400);
  });

  it('reports when the archive has no room left', async () => {
    const { status, body } = await send<ApiError>('POST', '/batches', {
      label: 'Too many',
      fileCount: 50_000,
    });

    expect(status).toBe(507);
    expect(body.remedy).toBeDefined();
  });
});

describe('batch progression', () => {
  it('advances as the client polls and settles', async () => {
    const created = await send<BatchSummary>('POST', '/batches', {
      label: 'Intake',
      fileCount: 30,
    });

    const settled = await drainBatch(created.body.id);

    expect(settled.counts.pending + settled.counts.processing).toBe(0);
    expect(Object.values(settled.counts).reduce((sum, value) => sum + value, 0)).toBe(30);
  });

  it('lands in more than one final state', async () => {
    const created = await send<BatchSummary>('POST', '/batches', {
      label: 'Large intake',
      fileCount: 300,
    });

    const settled = await drainBatch(created.body.id);

    expect(settled.counts.completed).toBeGreaterThan(0);
    expect(settled.counts.failed + settled.counts.needs_review).toBeGreaterThan(0);
  });

  it('lists batches newest first', async () => {
    await send('POST', '/batches', { label: 'First', fileCount: 5 });
    await send('POST', '/batches', { label: 'Second', fileCount: 5 });

    const { body } = await get<BatchSummary[]>('/batches');

    expect(body).toHaveLength(2);
    expect(body[0]?.createdAt).toBeGreaterThanOrEqual(body[1]?.createdAt ?? 0);
  });

  it('is a 404 for an unknown batch', async () => {
    expect((await get<ApiError>('/batches/batch-999')).status).toBe(404);
  });
});

describe('manual entry', () => {
  async function settledBatchWithFailures(): Promise<{ id: string; failed: DocumentSummary[] }> {
    const created = await send<BatchSummary>('POST', '/batches', {
      label: 'Intake',
      fileCount: 300,
    });
    await drainBatch(created.body.id);

    const { body } = await get<QueryResult>(
      `/documents?status=failed&batch=${created.body.id}&pageSize=200`,
    );
    return { id: created.body.id, failed: body.rows };
  }

  it('hands a failure a retry cannot fix to an operator', async () => {
    const { failed } = await settledBatchWithFailures();
    const target = failed.find((row) => row.errorCode && !isRetryable(row.errorCode));

    const { status, body } = await send<ManualEntryResult>(
      'POST',
      `/documents/${target?.id}/manual-entry`,
    );

    expect(status).toBe(200);
    expect(body.moved).toBe(1);

    const after = await get<DocumentDetail>(`/documents/${target?.id}`);
    expect(after.body.status).toBe('needs_review');
  });

  it('keeps the cause, so the review task explains itself', async () => {
    const { failed } = await settledBatchWithFailures();
    const target = failed.find((row) => row.errorCode && !isRetryable(row.errorCode));

    await send('POST', `/documents/${target?.id}/manual-entry`);
    const after = await get<DocumentDetail>(`/documents/${target?.id}`);

    expect(after.body.errorCode).toBe(target?.errorCode);
  });

  it('refuses a failure a retry could still clear', async () => {
    const { failed } = await settledBatchWithFailures();
    const target = failed.find((row) => row.errorCode && isRetryable(row.errorCode));

    const { status, body } = await send<ApiError>('POST', `/documents/${target?.id}/manual-entry`);

    expect(status).toBe(409);
    expect(body.remedy).toBeDefined();
  });

  it('moves every terminal failure in a batch and leaves the rest alone', async () => {
    const { id, failed } = await settledBatchWithFailures();
    const terminal = failed.filter((row) => row.errorCode && !isRetryable(row.errorCode)).length;
    const retryable = failed.length - terminal;

    const { status, body } = await send<ManualEntryResult>('POST', `/batches/${id}/manual-entry`);

    expect(status).toBe(200);
    expect(body.moved).toBe(terminal);
    expect(body.skipped).toBe(retryable);
  });

  it('leaves the batch with only failures worth retrying', async () => {
    const { id } = await settledBatchWithFailures();
    await send('POST', `/batches/${id}/manual-entry`);

    const { body } = await get<BatchSummary>(`/batches/${id}`);

    expect(body.counts.failed).toBe(body.retryableFailures);
    expect(body.failures.every((group) => group.retryable)).toBe(true);
  });
});

describe('retry', () => {
  async function settledBatchWithFailures(): Promise<{ id: string; failed: DocumentSummary[] }> {
    const created = await send<BatchSummary>('POST', '/batches', {
      label: 'Intake',
      fileCount: 300,
    });
    await drainBatch(created.body.id);

    // Scoped to the batch: the generated archive has its own failures, and a
    // batch retry must only account for its own.
    const { body } = await get<QueryResult>(
      `/documents?status=failed&batch=${created.body.id}&pageSize=200`,
    );
    return { id: created.body.id, failed: body.rows };
  }

  it('retries a failed document', async () => {
    const { failed } = await settledBatchWithFailures();
    const target = failed.find((row) => row.errorCode && isRetryable(row.errorCode));
    expect(target).toBeDefined();

    const { status, body } = await send<RetryResult>('POST', `/documents/${target?.id}/retry`);

    expect(status).toBe(200);
    expect(body.retried).toBe(1);
  });

  it('refuses to retry a failure a retry cannot fix', async () => {
    const { failed } = await settledBatchWithFailures();
    const target = failed.find((row) => row.errorCode && !isRetryable(row.errorCode));
    expect(target).toBeDefined();

    const { status, body } = await send<ApiError>('POST', `/documents/${target?.id}/retry`);

    expect(status).toBe(409);
    expect(body.code).toBe('not_retryable');
    // The point of refusing: say what to do instead.
    expect(body.remedy).toBeDefined();
  });

  it('retries a failure from the archive itself, which belongs to no upload', async () => {
    const { body } = await get<QueryResult>('/documents?status=failed&pageSize=50');
    const target = body.rows.find((row) => row.errorCode && isRetryable(row.errorCode));
    expect(target).toBeDefined();

    // Nothing has been uploaded in this test, so the document has no batch to be
    // requeued into. Refusing here would put a dead retry button on most of the
    // failures an operator can actually see.
    const { status } = await send<RetryResult>('POST', `/documents/${target?.id}/retry`);
    expect(status).toBe(200);

    const after = await get<DocumentDetail>(`/documents/${target?.id}`);
    expect(after.body.status).not.toBe('failed');
  });

  it('gathers reprocessed documents into a batch that can be watched', async () => {
    const { body } = await get<QueryResult>('/documents?status=failed&pageSize=50');
    const target = body.rows.find((row) => row.errorCode && isRetryable(row.errorCode));

    await send('POST', `/documents/${target?.id}/retry`);
    const batches = await get<BatchSummary[]>('/batches');

    expect(batches.body).toHaveLength(1);
    expect(batches.body[0]?.total).toBe(1);
  });

  it('refuses to retry a document that has not failed', async () => {
    const { body } = await get<QueryResult>('/documents?status=completed&pageSize=1');
    const { status } = await send<ApiError>('POST', `/documents/${body.rows[0]?.id}/retry`);

    expect(status).toBe(409);
  });

  it('retries a whole batch and reports what it skipped', async () => {
    const { id, failed } = await settledBatchWithFailures();
    const terminal = failed.filter((row) => row.errorCode && !isRetryable(row.errorCode)).length;

    const { status, body } = await send<RetryResult>('POST', `/batches/${id}/retry`, {});

    expect(status).toBe(200);
    expect(body.retried).toBeGreaterThan(0);
    expect(body.skipped).toBe(terminal);
  });

  it('keeps the whole batch after a retry, not only what it retried', async () => {
    const { id } = await settledBatchWithFailures();

    await send('POST', `/batches/${id}/retry`, {});
    const during = await get<BatchSummary>(`/batches/${id}`);
    const after = await drainBatch(id);

    expect(during.body.total).toBe(300);
    expect(after.total).toBe(300);
    expect((await get<QueryResult>(`/documents?batch=${id}&pageSize=1`)).body.total).toBe(300);
  });

  it('leaves the failures a retry cannot clear still counted', async () => {
    const { id, failed } = await settledBatchWithFailures();
    const terminal = failed.filter((row) => row.errorCode && !isRetryable(row.errorCode)).length;

    await send('POST', `/batches/${id}/retry`, {});
    const after = await drainBatch(id);

    expect(after.counts.failed).toBeGreaterThanOrEqual(terminal);
  });

  it('clears failures that a second attempt resolves', async () => {
    const { id, failed } = await settledBatchWithFailures();
    const before = failed.length;

    await send('POST', `/batches/${id}/retry`, {});
    await drainBatch(id);

    const after = (await get<QueryResult>(`/documents?status=failed&batch=${id}&pageSize=200`)).body
      .total;
    expect(after).toBeLessThan(before);
  });

  it('groups the failures of a batch by cause, largest first', async () => {
    const { id, failed } = await settledBatchWithFailures();
    const { body } = await get<BatchSummary>(`/batches/${id}`);

    const counted = body.failures.reduce((running, group) => running + group.count, 0);
    expect(counted).toBe(failed.length);

    const counts = body.failures.map((group) => group.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('reports how many failures in a batch a retry could clear', async () => {
    const { id, failed } = await settledBatchWithFailures();
    const retryable = failed.filter((row) => row.errorCode && isRetryable(row.errorCode)).length;

    const { body } = await get<BatchSummary>(`/batches/${id}`);

    expect(body.retryableFailures).toBe(retryable);
  });

  it('filters documents by the cause of their failure', async () => {
    const { id, failed } = await settledBatchWithFailures();
    const cause = failed.find((row) => row.errorCode !== undefined)?.errorCode;
    const expected = failed.filter((row) => row.errorCode === cause).length;

    const { body } = await get<QueryResult>(
      `/documents?batch=${id}&status=failed&cause=${cause}&pageSize=200`,
    );

    expect(body.total).toBe(expected);
    expect(body.rows.every((row) => row.errorCode === cause)).toBe(true);
  });

  it('stops matching an old cause once a document is retried', async () => {
    const { failed } = await settledBatchWithFailures();
    const target = failed.find((row) => row.errorCode && isRetryable(row.errorCode));
    const cause = target?.errorCode;

    await send('POST', `/documents/${target?.id}/retry`);

    const { body } = await get<QueryResult>(`/documents?cause=${cause}&pageSize=200`);
    expect(body.rows.some((row) => row.id === target?.id)).toBe(false);
  });

  it('scopes a batch view to that batch alone', async () => {
    const { id } = await settledBatchWithFailures();
    const { body } = await get<QueryResult>(`/documents?batch=${id}&pageSize=1`);
    const everything = await get<QueryResult>('/documents?pageSize=1');

    expect(body.total).toBe(300);
    expect(everything.body.total).toBeGreaterThan(body.total);
  });

  it('returns nothing for a batch that has no documents', async () => {
    expect((await get<QueryResult>('/documents?batch=batch-999')).body.total).toBe(0);
  });
});

describe('GET /analytics', () => {
  it('breaks the archive down without losing a document', async () => {
    const { status, body } = await get<ArchiveAnalytics>('/analytics');
    const sum = (counts: Record<string, number>) =>
      Object.values(counts).reduce((total, count) => total + count, 0);

    expect(status).toBe(200);
    expect(body.total).toBe(400);
    expect(sum(body.byStatus)).toBe(400);
    expect(sum(body.byType)).toBe(400);
  });

  // Two figures for the same archive on the same screen must not disagree.
  it('agrees with the summary endpoint', async () => {
    const summary = await get<ArchiveSummary>('/summary');
    const analytics = await get<ArchiveAnalytics>('/analytics');

    expect(analytics.body.byStatus).toEqual(summary.body.byStatus);
    expect(analytics.body.total).toBe(summary.body.total);
  });

  it('reports confidence over extracted documents only', async () => {
    const { body } = await get<ArchiveAnalytics>('/analytics');

    expect(body.extracted).toBe(body.byStatus.completed + body.byStatus.needs_review);
    expect(body.averageConfidence).toBeGreaterThan(0);
    expect(body.averageConfidence).toBeLessThanOrEqual(1);
  });
});

describe('GET /documents/export', () => {
  async function exportCsv(
    query = '',
  ): Promise<{ status: number; headers: Headers; text: string }> {
    const response = await fetch(`${BASE}/documents/export${query}`);
    return { status: response.status, headers: response.headers, text: await response.text() };
  }

  /** Data rows, without the header and the trailing blank. */
  function dataRows(text: string): string[] {
    return text.split('\r\n').slice(1, -1);
  }

  it('serves the whole archive as a downloadable csv', async () => {
    const { status, headers, text } = await exportCsv();

    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain('text/csv');
    expect(headers.get('content-disposition')).toMatch(/^attachment; filename=".+\.csv"$/);
    expect(dataRows(text)).toHaveLength(400);
  });

  // The route sits above `/documents/:id`, which would otherwise read `export`
  // as a document id and answer 404.
  it('is not swallowed by the document-by-id route', async () => {
    const { status } = await exportCsv();
    const missing = await get<ApiError>('/documents/ARC-999999');

    expect(status).toBe(200);
    expect(missing.status).toBe(404);
  });

  it('exports the filtered view rather than the whole archive', async () => {
    const failed = await get<QueryResult>('/documents?status=failed&pageSize=1');
    const { headers, text } = await exportCsv('?status=failed');

    expect(dataRows(text)).toHaveLength(failed.body.total);
    expect(headers.get('x-total-count')).toBe(String(failed.body.total));
  });

  it('exports in the order the grid was showing', async () => {
    const query = '?sort=confidence&dir=asc';
    const page = await get<QueryResult>(`/documents${query}&pageSize=5`);
    const { text } = await exportCsv(query);

    expect(
      dataRows(text)
        .slice(0, 5)
        .map((row) => row.split(',')[0]),
    ).toEqual(page.body.rows.map((row) => row.id));
  });

  // A streamed file has no exact length ahead of time, so the bar reads an
  // estimate scaled up from the first rows; it has to be in the right region.
  it('estimates the file size within a fifth, and declares no exact length', async () => {
    const { headers, text } = await exportCsv();
    const estimate = Number(headers.get('x-content-length-estimate'));
    const actual = new TextEncoder().encode(text).byteLength;

    expect(headers.get('content-length')).toBeNull();
    expect(estimate).toBeGreaterThan(actual * 0.8);
    expect(estimate).toBeLessThan(actual * 1.2);
  });

  it('writes a header-only file when the filter matches nothing', async () => {
    const { text, headers } = await exportCsv('?q=zzzzz-no-such-record');

    expect(dataRows(text)).toHaveLength(0);
    expect(headers.get('x-total-count')).toBe('0');
    expect(text.split('\r\n')[0]).toContain('ID');
  });

  it('carries an operator correction into the file', async () => {
    const queue = await get<QueryResult>('/documents?status=needs_review&pageSize=1');
    const target = queue.body.rows[0] as DocumentSummary;

    await send<DocumentDetail>('PATCH', `/documents/${target.id}`, {
      corrections: [{ field: 'personName', value: 'Rahima Khatun' }],
    });

    const { text } = await exportCsv();
    const row = dataRows(text).find((line) => line.startsWith(target.id));

    expect(row).toContain('Rahima Khatun');
  });
});
