'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { API_BASE } from '@/server/api-contract';
import type { IngestedFile } from '@/lib/file-ingest/types';
import { createUploadQueue, type UploadQueue } from '@/lib/upload-queue/queue';
import { PermanentFailure, type QueueSnapshot } from '@/lib/upload-queue/types';

type UploadItem = { id: string; label: string; size: number };

/** What a run came to, and whether it was allowed to finish. */
export type RunOutcome = {
  snapshot: QueueSnapshot;
  /** The queue was cancelled or discarded before it settled on its own. */
  cancelled: boolean;
};

/**
 * A 4xx is the file being refused, and sending it again changes nothing. 408
 * and 429 are the exceptions: the server is asking for exactly that. So is
 * 404, here: the API lives in a service worker, and a 404 from its own path
 * means the worker was not intercepting for a moment, not that the file was
 * turned away.
 */
function isRefusal(status: number): boolean {
  return status >= 400 && status < 500 && ![404, 408, 429].includes(status);
}

/** Sends one file. Throws on anything but success, so the queue can retry it. */
async function uploadFile(item: UploadItem, signal: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: item.label, size: item.size }),
    signal,
  });

  if (response.ok) return;

  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message ?? `Upload failed with ${response.status}`;

  throw isRefusal(response.status) ? new PermanentFailure(message) : new Error(message);
}

function subscribeToConnection(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);

  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Runs `flush` once per animation frame, however often it is asked.
 *
 * A queue reports every change as it happens — several per file, six files
 * in flight — and each report used to be a render of the whole upload view.
 * One frame's worth at a time is all a screen can show.
 */
function framePacer(flush: () => void): () => void {
  let scheduled = false;
  const schedule =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback: () => void) => setTimeout(callback, 16);

  return () => {
    if (scheduled) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      flush();
    });
  };
}

// Whether the browser believes it has a connection. The server cannot know, so it says yes.
function useIsOnline(): boolean {
  return useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Runs one upload queue and mirrors its state into React.
 *
 * The queue itself holds the state; this only re-renders from its snapshots.
 * Keeping the scheduling outside React is what makes concurrency, backoff and
 * pause testable without rendering anything.
 *
 * It also watches the connection. A wireless drop of half a minute would
 * otherwise fail a hundred files for good — six in flight, three attempts each,
 * a few seconds of backoff — so the queue pauses itself when the browser says
 * it is offline and picks up where it was when the connection returns.
 */
export function useUploadQueue() {
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  /** Paused by this hook for the network, as opposed to by the operator. */
  const [pausedForNetwork, setPausedForNetwork] = useState(false);
  const queueRef = useRef<UploadQueue | null>(null);
  const networkPause = useRef(false);
  const online = useIsOnline();

  // Held in a ref for the callbacks and in state for the screen.
  const markNetworkPause = useCallback((value: boolean) => {
    networkPause.current = value;
    setPausedForNetwork(value);
  }, []);

  // Only a pause this hook made is lifted; one the operator asked for stands.
  useEffect(() => {
    const queue = queueRef.current;
    if (queue === null) return;

    if (!online && !queue.snapshot().paused) {
      markNetworkPause(true);
      queue.pause();
    } else if (online && networkPause.current) {
      markNetworkPause(false);
      queue.resume();
    }
  }, [online, markNetworkPause]);

  // The page owns the queue. Leaving the page abandons it, rather than letting
  // it run on unseen and then pull the operator back to a batch they never
  // watched begin.
  useEffect(() => {
    const owned = queueRef;
    return () => {
      owned.current?.cancel();
      owned.current = null;
    };
  }, []);

  const run = useCallback(
    async (files: readonly IngestedFile[]): Promise<RunOutcome> => {
      const items: UploadItem[] = files.map((file, index) => ({
        id: `${index}-${file.path}`,
        label: file.name,
        size: file.size,
      }));

      // Only the queue this hook still owns may render. A discarded queue's
      // workers unwind after the reset, and would otherwise put its last
      // snapshot straight back on screen.
      const render = framePacer(() => {
        if (queueRef.current === queue) setSnapshot(queue.snapshot());
      });

      const queue: UploadQueue = createUploadQueue(items, {
        concurrency: 6,
        maxAttempts: 3,
        // The mock backend has no upload stream to report against, so a file
        // is either in flight or done; the row says which without a number.
        run: (item, context) => uploadFile(item, context.signal),
        onChange: render,
      });

      queueRef.current = queue;

      if (!navigator.onLine) {
        markNetworkPause(true);
        queue.pause();
      }

      await queue.start();

      const result = queue.snapshot();
      return { snapshot: result, cancelled: queueRef.current !== queue || result.cancelled > 0 };
    },
    [markNetworkPause],
  );

  const pause = useCallback(() => queueRef.current?.pause(), []);

  // While the browser still reports no connection a resume would only spend
  // every file's attempts against a dead network, so the pause stands.
  const resume = useCallback(() => {
    if (!navigator.onLine) return;

    markNetworkPause(false);
    queueRef.current?.resume();
  }, [markNetworkPause]);

  const cancel = useCallback(() => queueRef.current?.cancel(), []);

  const reset = useCallback(() => {
    queueRef.current?.cancel();
    queueRef.current = null;
    markNetworkPause(false);
    setSnapshot(null);
  }, [markNetworkPause]);

  return { snapshot, offline: !online, pausedForNetwork, run, pause, resume, cancel, reset };
}
