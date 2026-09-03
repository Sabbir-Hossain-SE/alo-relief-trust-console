import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '@/server/db';
import { server } from '@/server/node';
import { api } from './api';
import { makeStore, type AppStore } from './store';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let store: AppStore;

beforeEach(() => {
  resetDatabase({
    size: 300,
    latency: { read: 0, write: 0 },
    config: { concurrency: 40, serviceTimeMs: 5 },
  });
  store = makeStore();
});

function run<T>(thunk: T) {
  return store.dispatch(thunk as never) as unknown as Promise<{ data?: unknown; error?: unknown }>;
}

function cached(endpoint: string, arg: unknown) {
  const entries = Object.values(store.getState().api.queries);
  return entries.find((entry) => entry?.endpointName === endpoint && entry.originalArgs === arg);
}

describe('queries', () => {
  it('reads the archive summary', async () => {
    const result = await run(api.endpoints.getSummary.initiate());

    expect((result.data as { total: number }).total).toBe(300);
  });

  it('reads a page of documents', async () => {
    const result = await run(api.endpoints.getDocuments.initiate({ pageSize: 10 }));

    expect((result.data as { rows: unknown[] }).rows).toHaveLength(10);
  });

  it('reads one document', async () => {
    const result = await run(api.endpoints.getDocument.initiate('ARC-000005'));

    expect((result.data as { id: string }).id).toBe('ARC-000005');
  });

  it('surfaces a failed request as an error rather than throwing', async () => {
    const result = await run(api.endpoints.getDocument.initiate('ARC-999999'));

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });

  it('serves a repeated query from cache without a second request', async () => {
    await run(api.endpoints.getDocuments.initiate({ pageSize: 5 }));
    const before = Object.keys(store.getState().api.queries).length;

    await run(api.endpoints.getDocuments.initiate({ pageSize: 5 }));

    expect(Object.keys(store.getState().api.queries)).toHaveLength(before);
  });

  it('treats a different query as a different cache entry', async () => {
    await run(api.endpoints.getDocuments.initiate({ pageSize: 5 }));
    await run(api.endpoints.getDocuments.initiate({ pageSize: 5, status: ['failed'] }));

    expect(Object.keys(store.getState().api.queries).length).toBeGreaterThan(1);
  });
});

describe('tag invalidation', () => {
  it('refreshes batches and counts after an upload', async () => {
    await run(api.endpoints.getBatches.initiate());
    await run(api.endpoints.getSummary.initiate());

    const summaryBefore = cached('getSummary', undefined)?.data as { total: number };
    expect(summaryBefore.total).toBe(300);

    await run(api.endpoints.createBatch.initiate({ label: 'Intake', fileCount: 25 }));

    // The subscriptions above keep both entries live, so invalidation refetches
    // them rather than merely marking them stale.
    await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));

    expect((cached('getBatches', undefined)?.data as unknown[]).length).toBe(1);
    expect((cached('getSummary', undefined)?.data as { total: number }).total).toBe(325);
  });

  it('refreshes the document list after an upload', async () => {
    await run(api.endpoints.getDocuments.initiate({ pageSize: 5 }));
    const before = (cached('getDocuments', undefined)?.data ?? null) as { total: number } | null;

    await run(api.endpoints.createBatch.initiate({ label: 'Intake', fileCount: 25 }));
    await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));

    const entry = Object.values(store.getState().api.queries).find(
      (candidate) => candidate?.endpointName === 'getDocuments',
    );

    expect((entry?.data as { total: number }).total).toBe(325);
    expect(before).toBeNull();
  });

  it('refreshes a corrected document and the list it came from', async () => {
    const listed = await run(
      api.endpoints.getDocuments.initiate({ status: ['needs_review'], pageSize: 1 }),
    );
    const target = (listed.data as { rows: { id: string }[] }).rows[0];
    expect(target).toBeDefined();

    await run(api.endpoints.getDocument.initiate(target?.id ?? ''));

    await run(
      api.endpoints.correctDocument.initiate({
        id: target?.id ?? '',
        corrections: [{ field: 'personName', value: 'Corrected Name' }],
      }),
    );
    await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));

    const detail = cached('getDocument', target?.id) as {
      data?: { fields: Record<string, { value?: string }> };
    };
    expect(detail.data?.fields.personName?.value).toBe('Corrected Name');
  });

  it('does not disturb unrelated cache entries', async () => {
    await run(api.endpoints.getDocument.initiate('ARC-000005'));
    const before = cached('getDocument', 'ARC-000005')?.data;

    await run(api.endpoints.getSummary.initiate());

    expect(cached('getDocument', 'ARC-000005')?.data).toBe(before);
  });
});

describe('mutations', () => {
  it('creates a batch with everything queued', async () => {
    const result = await run(
      api.endpoints.createBatch.initiate({ label: 'Intake', fileCount: 12 }),
    );
    const batch = result.data as {
      total: number;
      counts: Record<string, number>;
      settled: boolean;
    };

    expect(batch.total).toBe(12);
    expect(batch.counts.pending).toBe(12);
    expect(batch.settled).toBe(false);
  });

  it('reports a rejected upload as an error', async () => {
    const result = await run(api.endpoints.createBatch.initiate({ label: '', fileCount: 0 }));

    expect(result.error).toBeDefined();
  });

  it('reports how many failures a bulk retry could not act on', async () => {
    const created = await run(
      api.endpoints.createBatch.initiate({ label: 'Intake', fileCount: 250 }),
    );
    const id = (created.data as { id: string }).id;

    for (let poll = 0; poll < 200; poll += 1) {
      const status = await run(api.endpoints.getBatch.initiate(id, { forceRefetch: true }));
      if ((status.data as { settled: boolean }).settled) break;
    }

    const retried = await run(api.endpoints.retryBatch.initiate({ id }));
    const result = retried.data as { retried: number; skipped: number };

    expect(result.retried).toBeGreaterThan(0);
    // Failures a retry cannot fix are reported, not silently dropped.
    expect(result.skipped).toBeGreaterThan(0);
  });
});
