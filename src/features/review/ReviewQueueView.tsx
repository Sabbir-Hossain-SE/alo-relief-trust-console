'use client';

import { Suspense } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { VirtualList } from '@/components/data/VirtualList';
import { DocumentDrawer } from '@/features/documents/components/DocumentDrawer';
import { useDocumentQuery } from '@/features/documents/useDocumentQuery';
import { formatCount } from '@/lib/format/number';
import { useDocuments } from '@/store/polling';
import { ReviewTask, TASK_HEIGHT } from './components/ReviewTask';

const LIST_HEIGHT = 560;

/** How much of the queue is fetched. It is worked from the top, not browsed. */
const QUEUE_DEPTH = 200;

/**
 * The work queue, least certain first.
 *
 * Ordered by the pipeline's own uncertainty rather than by date, because an
 * operator with an hour should spend it on the records extraction was least
 * sure about. Paging through a grid would make that ordering pointless, so the
 * queue fetches a working depth and virtualizes it.
 */
function ReviewQueue() {
  const { selectedId, select } = useDocumentQuery();

  const { data, isLoading, isError, refetch } = useDocuments({
    status: ['needs_review'],
    sortField: 'confidence',
    sortDirection: 'asc',
    pageSize: QUEUE_DEPTH,
  });

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Records the pipeline was not sure about, least certain first."
      />

      {isError ? (
        <ErrorState
          title="The review queue could not be read"
          description="The request for documents needing review did not come back."
          onRetry={() => void refetch()}
        />
      ) : isLoading || data === undefined ? (
        <Skeleton variant="rounded" height={LIST_HEIGHT} />
      ) : data.total === 0 ? (
        <EmptyState
          icon={<CheckCircleOutlinedIcon fontSize="inherit" />}
          title="Nothing to review"
          description="Every extracted record has either passed or been checked by hand."
        />
      ) : (
        <Box className="flex flex-col gap-3">
          {/* Deliberately not a live region. Polling refreshes this every 1.5s
              while a batch runs, so announcing it would talk over everything
              else — the same mistake ProgressAnnouncer exists to avoid. */}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {formatCount(data.total)} {data.total === 1 ? 'record needs' : 'records need'} checking
            {data.total > data.rows.length
              ? ` · working through the ${formatCount(data.rows.length)} least certain`
              : ''}
          </Typography>

          <Paper>
            <VirtualList
              items={data.rows}
              itemHeight={TASK_HEIGHT}
              height={LIST_HEIGHT}
              label="Review queue"
              roving
              getKey={(row) => row.id}
              renderItem={(row, _index, rowProps) => (
                <ReviewTask
                  row={row}
                  rowProps={rowProps}
                  onOpen={() => select(row.id)}
                  isOpen={row.id === selectedId}
                />
              )}
            />
          </Paper>
        </Box>
      )}

      <DocumentDrawer documentId={selectedId} onClose={() => select(null)} />
    </>
  );
}

// useSearchParams needs a Suspense boundary above it.
export function ReviewQueueView() {
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={LIST_HEIGHT} />}>
      <ReviewQueue />
    </Suspense>
  );
}
