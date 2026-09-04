'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageSections, SECTION_CONTENT_GAP } from '@/components/layout/PageSections';
import { LinkButton } from '@/components/ui/LinkButton';
import { useBatches } from '@/store/polling';
import { BatchListRow } from './components/BatchListRow';

// Every upload this session, newest first.
export function BatchListView() {
  const { data, isLoading, isError, refetch } = useBatches();

  return (
    <PageSections>
      <PageHeader
        title="Batches"
        description="Uploads and what processing made of them."
        actions={
          <LinkButton href="/upload" variant="contained" startIcon={<CloudUploadOutlinedIcon />}>
            Upload documents
          </LinkButton>
        }
      />

      {isError ? (
        <ErrorState
          title="The batches could not be read"
          description="The request for this session's batches did not come back."
          onRetry={() => void refetch()}
        />
      ) : isLoading || data === undefined ? (
        <Box className={SECTION_CONTENT_GAP}>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} variant="rounded" height={168} />
          ))}
        </Box>
      ) : data.length === 0 ? (
        <EmptyState
          title="No batches yet"
          description="Upload a folder of documents and its progress will be tracked here."
          action={
            <LinkButton href="/upload" variant="contained">
              Upload documents
            </LinkButton>
          }
        />
      ) : (
        <Box className={SECTION_CONTENT_GAP}>
          {data.map((summary) => (
            <BatchListRow key={summary.id} summary={summary} />
          ))}
        </Box>
      )}
    </PageSections>
  );
}
