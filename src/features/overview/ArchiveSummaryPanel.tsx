'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { StatCard } from '@/components/data/StatCard';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PROCESSING_STATUSES } from '@/domain/status';
import { formatCount } from '@/lib/format/number';
import { useSummary } from '@/store/polling';

const CARD_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5';

const SECTION = 'flex flex-col gap-4';

export function ArchiveSummaryPanel() {
  const { data, isLoading, isError, refetch } = useSummary();

  if (isError) {
    return (
      <ErrorState
        title="The archive could not be read"
        description="The request for the archive summary did not come back."
        onRetry={() => void refetch()}
      />
    );
  }

  if (isLoading || data === undefined) {
    return (
      <Box className={SECTION}>
        <Paper className="p-6">
          <Skeleton variant="text" width={180} />
          <Skeleton variant="text" width={260} height={56} />
        </Paper>
        <Box className={CARD_GRID}>
          {PROCESSING_STATUSES.map((status) => (
            <Skeleton key={status} variant="rounded" height={132} />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box className={SECTION}>
      <Paper className="p-6">
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Documents in the archive
        </Typography>
        <Typography variant="h1" component="p" className="figures" sx={{ mt: 0.5 }}>
          {formatCount(data.total)}
        </Typography>
      </Paper>

      <Box className={CARD_GRID}>
        {PROCESSING_STATUSES.map((status) => (
          <StatCard key={status} status={status} count={data.byStatus[status]} total={data.total} />
        ))}
      </Box>
    </Box>
  );
}
