'use client';

import { useCallback, useRef, useState } from 'react';
import { API_BASE } from '@/server/api-contract';
import type { IngestedFile } from '@/lib/file-ingest/types';
import { createUploadQueue, type UploadQueue } from '@/lib/upload-queue/queue';
import type { QueueSnapshot } from '@/lib/upload-queue/types';

type UploadItem = { id: string; label: string; size: number };

/** Sends one file. Throws on anything but success, so the queue can retry it. */
async function uploadFile(item: UploadItem, signal: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: item.label, size: item.size }),
    signal,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Upload failed with ${response.status}`);
  }
}

/**
 * Runs one upload queue and mirrors its state into React.
 *
 * The queue itself holds the state; this only re-renders from its snapshots.
 * Keeping the scheduling outside React is what makes concurrency, backoff and
 * pause testable without rendering anything.
 */
export function useUploadQueue() {
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  const queueRef = useRef<UploadQueue | null>(null);

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
    await queue.start();

    return queue.snapshot();
  }, []);

  const pause = useCallback(() => queueRef.current?.pause(), []);
  const resume = useCallback(() => queueRef.current?.resume(), []);
  const cancel = useCallback(() => queueRef.current?.cancel(), []);

  const reset = useCallback(() => {
    queueRef.current?.cancel();
    queueRef.current = null;
    setSnapshot(null);
  }, []);

  return { snapshot, run, pause, resume, cancel, reset };
}
