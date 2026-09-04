'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageSections, SECTION_CONTENT_GAP } from '@/components/layout/PageSections';
import { batchHref } from '@/features/batches/links';
import { BATCH_LABEL_MAX_LENGTH, type CreateBatchInput } from '@/server/api-contract';
import { useCreateBatchMutation } from '@/store/api';
import { apiErrorMessage } from '@/store/apiError';
import { IndexingProgress, IngestSummary } from './components/IngestSummary';
import { UploadDropzone } from './components/UploadDropzone';
import { UploadQueueList } from './components/UploadQueueList';
import { useIngest } from './useIngest';
import { useUnloadWarning } from './useUnloadWarning';
import { useUploadQueue } from './useUploadQueue';

// Names the batch after what was dropped, so it is recognisable in a list.
function labelFor(firstPath: string | undefined): string {
  if (firstPath === undefined) return 'Upload';

  const folder = firstPath.split('/')[0];
  if (!folder || folder === firstPath) return 'Upload';

  // A folder can be named at any length; the API cannot take one past its
  // limit, and refusing the batch over its name would waste an upload that
  // has already succeeded.
  return folder.slice(0, BATCH_LABEL_MAX_LENGTH);
}

/** Resolves once the browser reports a connection, or at once if it already does. */
function untilOnline(): Promise<void> {
  if (navigator.onLine) return Promise.resolve();
  return new Promise((resolve) =>
    window.addEventListener('online', () => resolve(), { once: true }),
  );
}

type SendState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'failed'; message: string; batch: CreateBatchInput };

export function UploadView() {
  const router = useRouter();
  const { state, ingestEntries, ingestFiles, cancel, reset } = useIngest();
  const queue = useUploadQueue();
  const [createBatch] = useCreateBatchMutation();
  const [send, setSend] = useState<SendState>({ status: 'idle' });

  // A request can outlive the page it was sent from. The batch it creates is
  // real either way; the navigation to it belongs to this page alone.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const uploading = queue.snapshot !== null && !queue.snapshot.settled;
  useUnloadWarning(uploading || send.status === 'sending');

  async function openBatch(batch: CreateBatchInput) {
    setSend({ status: 'sending' });

    try {
      const created = await createBatch(batch).unwrap();

      // The archive answers from inside the browser; the next screen does not.
      // A route change with no connection fails and the browser replaces the
      // console with its own error page, so it waits for one.
      await untilOnline();
      if (!mounted.current) return;

      reset();
      queue.reset();
      setSend({ status: 'idle' });
      // Straight to the monitor, not the grid: the next thing that matters is
      // whether processing succeeds, and the grid cannot show that as a whole.
      router.push(batchHref(created.id));
    } catch (error) {
      if (!mounted.current) return;

      // The files are on the server; only the record grouping them is missing.
      // So this step is offered again, rather than the whole upload.
      setSend({
        status: 'failed',
        batch,
        message: apiErrorMessage(error) ?? 'The batch could not be created.',
      });
    }
  }

  async function start() {
    if (state.status !== 'ready') return;

    setSend({ status: 'sending' });
    const { snapshot, cancelled } = await queue.run(state.result.files);

    // A cancelled run is not a batch, whatever had already arrived: the
    // operator asked for it to stop, and opening a monitor for the part that
    // got through would answer that by leaving the page. Nor is a run in which
    // nothing arrived — counting the whole selection would overstate the
    // archive by every file that failed.
    if (cancelled || snapshot.succeeded === 0) {
      if (mounted.current) setSend({ status: 'idle' });
      return;
    }

    await openBatch({
      label: labelFor(state.result.files[0]?.path),
      fileCount: snapshot.succeeded,
    });
  }

  function discardQueue() {
    const batchFailed = send.status === 'failed';

    queue.cancel();
    queue.reset();
    // After a failed batch creation the files are already on the server, so the
    // same selection is not offered again — starting it would send every one of
    // them twice.
    if (batchFailed) reset();
    setSend({ status: 'idle' });
  }

  return (
    <PageSections>
      <PageHeader
        title="Upload"
        description="Add documents to the archive. A folder of any size is indexed before anything is sent."
      />

      <Box className={SECTION_CONTENT_GAP}>
        {state.status === 'idle' ? (
          <UploadDropzone
            onEntries={(entries) => void ingestEntries(entries)}
            onFiles={(files) => void ingestFiles(files)}
          />
        ) : null}

        {state.status === 'indexing' ? (
          <IndexingProgress progress={state.progress} onCancel={cancel} />
        ) : null}

        {state.status === 'ready' && queue.snapshot === null ? (
          <IngestSummary
            result={state.result}
            onStart={() => void start()}
            onDiscard={reset}
            isStarting={send.status === 'sending'}
          />
        ) : null}

        {queue.snapshot !== null ? (
          <UploadQueueList
            snapshot={queue.snapshot}
            offline={queue.offline}
            pausedForNetwork={queue.pausedForNetwork}
            onPause={queue.pause}
            onResume={queue.resume}
            onCancel={discardQueue}
          />
        ) : null}

        {send.status === 'failed' ? (
          <ErrorState
            title="The files were sent, but the batch could not be started"
            description={send.message}
            onRetry={() => void openBatch(send.batch)}
            retryLabel="Start the batch again"
          />
        ) : null}
      </Box>
    </PageSections>
  );
}
