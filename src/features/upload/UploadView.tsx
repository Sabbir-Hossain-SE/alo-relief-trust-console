'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCreateBatchMutation } from '@/store/api';
import { IndexingProgress, IngestSummary } from './components/IngestSummary';
import { UploadDropzone } from './components/UploadDropzone';
import { useIngest } from './useIngest';

// Names the batch after what was dropped, so it is recognisable in a list.
function labelFor(firstPath: string | undefined): string {
  if (firstPath === undefined) return 'Upload';

  const folder = firstPath.split('/')[0];
  return folder && folder !== firstPath ? folder : 'Upload';
}

export function UploadView() {
  const router = useRouter();
  const { state, ingestEntries, ingestFiles, cancel, reset } = useIngest();
  const [createBatch, { isLoading: isStarting }] = useCreateBatchMutation();

  async function start() {
    if (state.status !== 'ready') return;

    const batch = await createBatch({
      label: labelFor(state.result.files[0]?.path),
      fileCount: state.result.accepted,
    }).unwrap();

    reset();
    // The batch monitor arrives in #16; until then the batch's own filtered
    // view is the useful destination.
    router.push(`/documents?batch=${batch.id}`);
  }

  return (
    <>
      <PageHeader
        title="Upload"
        description="Add documents to the archive. A folder of any size is indexed before anything is sent."
      />

      <Box className="flex flex-col gap-4">
        {state.status !== 'ready' ? (
          <UploadDropzone
            disabled={state.status === 'indexing'}
            onEntries={(entries) => void ingestEntries(entries)}
            onFiles={(files) => void ingestFiles(files)}
          />
        ) : null}

        {state.status === 'indexing' ? (
          <IndexingProgress progress={state.progress} onCancel={cancel} />
        ) : null}

        {state.status === 'ready' ? (
          <IngestSummary
            result={state.result}
            onStart={() => void start()}
            onDiscard={reset}
            isStarting={isStarting}
          />
        ) : null}
      </Box>
    </>
  );
}
