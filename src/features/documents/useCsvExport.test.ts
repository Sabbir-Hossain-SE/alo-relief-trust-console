import { act, renderHook, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpResponse, delay, http } from 'msw';
import { resetDatabase } from '@/server/db';
import { server } from '@/server/node';
import { useCsvExport } from './useCsvExport';

/** What the browser was actually handed, in the order it was handed it. */
const saved: { blob: Blob; fileName: string }[] = [];
let offered: Blob | null = null;

function defineStatic(name: 'createObjectURL' | 'revokeObjectURL', value: unknown): void {
  Object.defineProperty(URL, name, { value, configurable: true, writable: true });
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });

  // jsdom implements neither, and what reaches them is the point of the test.
  // Defined onto the real URL rather than replacing it: everything underneath —
  // the request handlers included — constructs URLs, and a plain object spread
  // of the class is not a constructor.
  defineStatic('createObjectURL', (blob: Blob) => {
    offered = blob;
    return 'blob:mock';
  });
  defineStatic('revokeObjectURL', () => undefined);

  // A download is the anchor click, not the object URL: recording it here is
  // what proves the file was offered rather than merely built.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (offered !== null) saved.push({ blob: offered, fileName: this.download });
    offered = null;
  });
});

afterEach(() => {
  server.resetHandlers();
  saved.length = 0;
  offered = null;
});

afterAll(() => server.close());

beforeEach(() =>
  resetDatabase({
    size: 200,
    latency: { read: 0, write: 0 },
    config: { concurrency: 40, serviceTimeMs: 5 },
  }),
);

/** The one file handed to the browser, decoded. */
async function savedFile(): Promise<{ text: string; fileName: string }> {
  await waitFor(() => expect(saved).toHaveLength(1));
  const file = saved[0] as { blob: Blob; fileName: string };

  return { text: await file.blob.text(), fileName: file.fileName };
}

describe('useCsvExport', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useCsvExport());

    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('downloads the whole archive when nothing is filtered', async () => {
    const { result } = renderHook(() => useCsvExport());

    await act(() => result.current.start({}));

    expect(result.current.state).toEqual({ status: 'done', rows: 200 });

    const file = await savedFile();
    // `Blob.text()` decodes as UTF-8, which strips the byte order mark the
    // serializer writes, so the header is what is left to assert here. The mark
    // itself is covered where it is produced.
    expect(file.text.startsWith('ID,')).toBe(true);
    expect(file.text.trimEnd().split('\r\n')).toHaveLength(201);
    expect(file.fileName).toMatch(/\.csv$/);
  });

  it('downloads only what the filter matched', async () => {
    const { result } = renderHook(() => useCsvExport());

    await act(() => result.current.start({ status: ['failed'] }));

    const state = result.current.state;
    expect(state.status).toBe('done');
    expect(state.status === 'done' && state.rows).toBeGreaterThan(0);
    expect(state.status === 'done' && state.rows).toBeLessThan(200);
  });

  /**
   * "Export the current view" means every row the filter matched, not the fifty
   * on screen. Sending the grid's paging through would produce a file that
   * silently depends on which page the operator happened to be looking at.
   */
  it('ignores the grid paging', async () => {
    const { result } = renderHook(() => useCsvExport());

    await act(() => result.current.start({ page: 3, pageSize: 25 }));

    expect(result.current.state).toEqual({ status: 'done', rows: 200 });
  });

  // A file of nothing but column names makes an operator open it to find out
  // it was empty.
  it('saves no file when the filter matches nothing', async () => {
    const { result } = renderHook(() => useCsvExport());

    await act(() => result.current.start({ search: 'zzzzz-no-such-record' }));

    expect(result.current.state).toEqual({ status: 'done', rows: 0 });
    expect(saved).toHaveLength(0);
  });

  it('reports a failure without pretending it saved something', async () => {
    server.use(http.get('*/api/documents/export', () => new HttpResponse('nope', { status: 500 })));

    const { result } = renderHook(() => useCsvExport());
    await act(() => result.current.start({}));

    expect(result.current.state.status).toBe('failed');
    expect(saved).toHaveLength(0);
  });

  it('treats a cancel as a cancel rather than a failure', async () => {
    server.use(
      http.get('*/api/documents/export', async () => {
        await delay(500);
        return new HttpResponse('late', { status: 200 });
      }),
    );

    const { result } = renderHook(() => useCsvExport());

    let running: Promise<void>;
    act(() => {
      running = result.current.start({});
    });

    await waitFor(() => expect(result.current.state.status).toBe('running'));

    await act(async () => {
      result.current.cancel();
      await running;
    });

    expect(result.current.state).toEqual({ status: 'cancelled' });
    expect(saved).toHaveLength(0);
  });

  it('can be dismissed back to idle', async () => {
    const { result } = renderHook(() => useCsvExport());

    await act(() => result.current.start({ search: 'zzzzz-no-such-record' }));
    act(() => result.current.dismiss());

    expect(result.current.state).toEqual({ status: 'idle' });
  });
});
