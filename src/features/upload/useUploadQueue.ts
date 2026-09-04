'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { API_BASE } from '@/server/api-contract';
import type { IngestedFile } from '@/lib/file-ingest/types';
import { createUploadQueue, type UploadQueue } from '@/lib/upload-queue/queue';
import { PermanentFailure, type QueueSnapshot } from '@/lib/upload-queue/types';

type UploadItem = { id: string; label: string; size: number };

// A 4xx is the file being refused, and sending it again changes nothing. 408
// and 429 are the exceptions: the server is asking for exactly that.
function isRefusal(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
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
  const queueRef = useRef<UploadQueue | null>(null);
  const pausedForNetwork = useRef(false);
  const online = useIsOnline();

  // Only a pause this hook made is lifted; one the operator asked for stands.
  useEffect(() => {
    const queue = queueRef.current;
    if (queue === null) return;

    if (!online && !queue.snapshot().paused) {
      pausedForNetwork.current = true;
      queue.pause();
    } else if (online && pausedForNetwork.current) {
      pausedForNetwork.current = false;
      queue.resume();
    }
  }, [online]);

  const run = useCallback(async (files: readonly IngestedFile[]): Promise<QueueSnapshot> => {
    const items: UploadItem[] = files.map((file, index) => ({
      id: `${index}-${file.path}`,
      label: file.name,
      size: file.size,
    }));

    const queue = createUploadQueue(items, {
      concurrency: 6,
      maxAttempts: 3,
      run: async (item, context) => {
        // Coarse but honest: the mock backend has no upload stream to report
        // against, so a file is either in flight or done.
        context.onProgress(0.1);
        await uploadFile(item, context.signal);
        context.onProgress(1);
      },
      onChange: setSnapshot,
    });

    queueRef.current = queue;

    if (!navigator.onLine) {
      pausedForNetwork.current = true;
      queue.pause();
    }

    await queue.start();

    return queue.snapshot();
  }, []);

  const pause = useCallback(() => queueRef.current?.pause(), []);

  const resume = useCallback(() => {
    pausedForNetwork.current = false;
    queueRef.current?.resume();
  }, []);

  const cancel = useCallback(() => queueRef.current?.cancel(), []);

  const reset = useCallback(() => {
    queueRef.current?.cancel();
    queueRef.current = null;
    pausedForNetwork.current = false;
    setSnapshot(null);
  }, []);

  return { snapshot, offline: !online, run, pause, resume, cancel, reset };
}
