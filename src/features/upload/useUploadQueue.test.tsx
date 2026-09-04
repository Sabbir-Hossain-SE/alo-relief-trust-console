import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IngestedFile } from '@/lib/file-ingest/types';
import { useUploadQueue, type RunOutcome } from './useUploadQueue';

const files = (count: number): IngestedFile[] =>
  Array.from({ length: count }, (_, i) => ({
    path: `scan-${i}.pdf`,
    name: `scan-${i}.pdf`,
    size: 10,
  }));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A server that takes a moment over each file, so a run can be interrupted. */
function slowServer(delayMs = 30) {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    await sleep(delayMs);
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return new Response(JSON.stringify({ accepted: true }), { status: 200 });
  });
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

// A run is started inside `act` and awaited later; this names the gap.
function started(run: Promise<RunOutcome> | undefined): Promise<RunOutcome> {
  if (run === undefined) throw new Error('The run was never started');
  return run;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setOnline(true);
});

/**
 * The queue library is tested on its own. These cover what wraps it: who owns
 * the snapshot, and what a cancel or a departure means for the run's result.
 */
describe('useUploadQueue', () => {
  it('reports a cancelled run as cancelled, and never shows the dead queue again', async () => {
    vi.stubGlobal('fetch', slowServer());
    const { result } = renderHook(() => useUploadQueue());

    let run: Promise<RunOutcome> | undefined;
    act(() => {
      run = result.current.run(files(12));
    });
    await waitFor(() => expect(result.current.snapshot?.running).toBeGreaterThan(0));

    act(() => {
      result.current.cancel();
      result.current.reset();
    });

    let outcome: RunOutcome | undefined;
    await act(async () => {
      outcome = await started(run);
    });

    expect(outcome?.cancelled).toBe(true);
    expect(outcome?.snapshot.succeeded).toBeLessThan(12);

    // The workers unwind after the reset, and used to put the last snapshot
    // straight back on screen — a settled panel whose buttons did nothing.
    await act(() => sleep(100));
    expect(result.current.snapshot).toBeNull();
  });

  it('abandons the queue when the page is left', async () => {
    vi.stubGlobal('fetch', slowServer());
    const { result, unmount } = renderHook(() => useUploadQueue());

    let run: Promise<RunOutcome> | undefined;
    act(() => {
      run = result.current.run(files(12));
    });
    await waitFor(() => expect(result.current.snapshot?.running).toBeGreaterThan(0));

    unmount();

    const outcome = await started(run);
    expect(outcome.cancelled).toBe(true);
    expect(outcome.snapshot.cancelled).toBeGreaterThan(0);
  });

  it('holds a network pause when asked to resume while still offline', async () => {
    vi.stubGlobal('fetch', slowServer());
    setOnline(false);
    const { result } = renderHook(() => useUploadQueue());

    act(() => {
      void result.current.run(files(3));
    });
    await waitFor(() => expect(result.current.snapshot?.paused).toBe(true));
    expect(result.current.pausedForNetwork).toBe(true);

    // A resume against a dead network would only spend every file's attempts.
    act(() => result.current.resume());
    expect(result.current.snapshot?.paused).toBe(true);
    expect(result.current.pausedForNetwork).toBe(true);

    // The connection returning is what lifts it.
    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current.snapshot?.settled).toBe(true));
    expect(result.current.snapshot?.succeeded).toBe(3);
    expect(result.current.pausedForNetwork).toBe(false);
  });
});
