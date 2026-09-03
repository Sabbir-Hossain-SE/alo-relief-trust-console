'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import { PageHeader } from '@/components/layout/PageHeader';
import { batchHref } from '@/features/batches/links';
import { useCreateBatchMutation } from '@/store/api';
import { IndexingProgress, IngestSummary } from './components/IngestSummary';
import { UploadDropzone } from './components/UploadDropzone';
import { UploadQueueList } from './components/UploadQueueList';
import { useIngest } from './useIngest';
import { useUploadQueue } from './useUploadQueue';

// Names the batch after what was dropped, so it is recognisable in a list.
function labelFor(firstPath: string | undefined): string {
  if (firstPath === undefined) return 'Upload';

  const folder = firstPath.split('/')[0];
  return folder && folder !== firstPath ? folder : 'Upload';
}

export function UploadView() {
  const router = useRouter();
  const { state, ingestEntries, ingestFiles, cancel, reset } = useIngest();
  const queue = useUploadQueue();
  const [createBatch] = useCreateBatchMutation();
  const [isSending, setIsSending] = useState(false);

  async function start() {
    if (state.status !== 'ready') return;

    setIsSending(true);

    try {
      const result = await queue.run(state.result.files);

      // Only what actually arrived becomes a batch. Counting the whole
      // selection would overstate the archive by every file that failed.
      if (result.succeeded === 0) return;

      const batch = await createBatch({
        label: labelFor(state.result.files[0]?.path),
        fileCount: result.succeeded,
      }).unwrap();

      reset();
      queue.reset();
      // Straight to the monitor, not the grid: the next thing that matters is
      // whether processing succeeds, and the grid cannot show that as a whole.
      router.push(batchHref(batch.id));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Upload"
        description="Add documents to the archive. A folder of any size is indexed before anything is sent."
      />

      <Box className="flex flex-col gap-4">
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
            isStarting={isSending}
          />
        ) : null}

        {queue.snapshot !== null ? (
          <UploadQueueList
            snapshot={queue.snapshot}
            onPause={queue.pause}
            onResume={queue.resume}
            onCancel={() => {
              queue.cancel();
              queue.reset();
            }}
          />
        ) : null}
      </Box>
    </>
  );
}
