'use client';

import { useCallback, useRef, useState } from 'react';
import type { FsEntry, IngestProgress, IngestResult } from '@/lib/file-ingest/types';
import { ingestFileList, walkEntries } from '@/lib/file-ingest/walk';

type IngestState =
  | { status: 'idle' }
  | { status: 'indexing'; progress: IngestProgress }
  | { status: 'ready'; result: IngestResult };

/**
 * Drives one ingestion at a time.
 *
 * The walk is cancellable, so the controller is kept for the life of the run
 * and a second drop aborts the first rather than interleaving two walks into
 * the same result.
 */
export function useIngest() {
  const [state, setState] = useState<IngestState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(
    async (
      walk: (options: {
        signal: AbortSignal;
        onProgress: (p: IngestProgress) => void;
      }) => Promise<IngestResult>,
    ) => {
      controller.current?.abort();

      const next = new AbortController();
      controller.current = next;

      setState({ status: 'indexing', progress: { scanned: 0, accepted: 0, rejected: 0 } });

      const result = await walk({
        signal: next.signal,
        onProgress: (progress) => setState({ status: 'indexing', progress }),
      });

      // A superseded run must not overwrite the one that replaced it.
      if (controller.current !== next) return;

      controller.current = null;
      setState({ status: 'ready', result });
    },
    [],
  );

  const ingestEntries = useCallback(
    (entries: FsEntry[]) => run((options) => walkEntries(entries, options)),
    [run],
  );

  const ingestFiles = useCallback(
    (files: File[]) => run((options) => ingestFileList(files, options)),
    [run],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: 'idle' });
  }, []);

  return { state, ingestEntries, ingestFiles, cancel, reset };
}
