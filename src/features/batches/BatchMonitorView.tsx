'use client';

import Box from '@mui/material/Box';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageSections, SECTION_CONTENT_GAP } from '@/components/layout/PageSections';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ProgressAnnouncer, decile } from '@/components/feedback/ProgressAnnouncer';
import { LinkButton } from '@/components/ui/LinkButton';
import { useBatch } from '@/store/polling';
import { BatchFailures } from './components/BatchFailures';
import { BatchMonitorPanel } from './components/BatchMonitorPanel';
import { BatchSplit } from './components/BatchSplit';
import { batchDocumentsHref } from './links';
import { batchProgress, progressMessage } from './progress';

// Watches one batch through to its outcome.
export function BatchMonitorView({ batchId }: { batchId: string }) {
  const { data, isError, refetch } = useBatch(batchId);

  if (isError) {
    return (
      <PageSections>
        <PageHeader title="Batch" />
        <ErrorState
          title="That batch is not here"
          // Worth saying plainly rather than implying the batch failed: the mock
          // backend keeps everything in memory, so a reload starts a fresh
          // archive and the batches from the previous session are gone.
          description="It may have finished in an earlier session. The mock backend holds batches in memory, so reloading the page starts again with none."
          onRetry={() => void refetch()}
        />
      </PageSections>
    );
  }

  return (
    <PageSections>
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

      <Box className={SECTION_CONTENT_GAP}>
        <BatchMonitorPanel summary={data} />
        <BatchSplit summary={data} />
        {data === undefined ? null : <BatchFailures summary={data} />}
      </Box>

      {data === undefined ? null : (
        <ProgressAnnouncer
          step={decile(batchProgress(data).completion)}
          message={progressMessage(data)}
          final={data.settled}
        />
      )}
    </PageSections>
  );
}
