'use client';

import Box from '@mui/material/Box';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ProgressAnnouncer } from '@/components/feedback/ProgressAnnouncer';
import { LinkButton } from '@/components/ui/LinkButton';
import { useBatch } from '@/store/polling';
import { BatchMonitorPanel } from './components/BatchMonitorPanel';
import { BatchSplit } from './components/BatchSplit';
import { batchDocumentsHref } from './links';
import { batchProgress, progressMessage } from './progress';

// Watches one batch through to its outcome.
export function BatchMonitorView({ batchId }: { batchId: string }) {
  const { data, isError, refetch } = useBatch(batchId);

  if (isError) {
    return (
      <>
        <PageHeader title="Batch" />
        <ErrorState
          title="That batch is not here"
          // Worth saying plainly rather than implying the batch failed: the mock
          // backend keeps everything in memory, so a reload starts a fresh
          // archive and the batches from the previous session are gone.
          description="It may have finished in an earlier session. The mock backend holds batches in memory, so reloading the page starts again with none."
          onRetry={() => void refetch()}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={data?.settled === true ? 'Batch complete' : 'Batch in progress'}
        description="Every document in this upload, and what processing made of it."
        actions={
          data === undefined ? null : (
            <LinkButton
              href={batchDocumentsHref(data.id)}
              variant="outlined"
              startIcon={<DescriptionOutlinedIcon />}
            >
              Open in documents
            </LinkButton>
          )
        }
      />

      <Box className="flex flex-col gap-4">
        <BatchMonitorPanel summary={data} />
        <BatchSplit summary={data} />
      </Box>

      {data === undefined ? null : (
        <ProgressAnnouncer
          completion={batchProgress(data).completion}
          message={progressMessage(data)}
          settled={data.settled}
        />
      )}
    </>
  );
}
