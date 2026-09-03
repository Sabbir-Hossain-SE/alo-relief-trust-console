'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import type { ProcessingStatus } from '@/domain/status';
import { StatCard } from '@/components/data/StatCard';
import type { BatchSummary } from '@/server/simulator/batch';
import { batchDocumentsHref } from '../links';

/**
 * The four outcomes an operator acts on. Pending is deliberately absent: it is
 * the absence of an outcome, and it is already reported as the queued count and
 * as the unfilled part of the bar.
 */
const OUTCOMES: readonly ProcessingStatus[] = ['completed', 'processing', 'failed', 'needs_review'];

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4';

// The four-way split, each figure opening the documents behind it.
export function BatchSplit({ summary }: { summary: BatchSummary | undefined }) {
  if (summary === undefined) {
    return (
      <Box className={GRID}>
        {OUTCOMES.map((status) => (
          <Skeleton key={status} variant="rounded" height={132} />
        ))}
      </Box>
    );
  }

  return (
    <Box className={GRID}>
      {OUTCOMES.map((status) => (
        <StatCard
          key={status}
          status={status}
          count={summary.counts[status]}
          total={summary.total}
          href={batchDocumentsHref(summary.id, status)}
        />
      ))}
    </Box>
  );
}
