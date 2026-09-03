'use client';

import Box from '@mui/material/Box';
import type { ProcessingStatus } from '@/domain/status';
import type { BatchSummary } from '@/server/simulator/batch';
import { batchProgress } from '../progress';

/**
 * Finished work first, then what is moving. Pending is the unfilled track, so
 * the bar reads as "how far along, and how it turned out" in one glance.
 */
const SEGMENTS: readonly ProcessingStatus[] = ['completed', 'needs_review', 'failed', 'processing'];

type BatchProgressBarProps = {
  summary: BatchSummary;
  height?: number;
};

// Progress split by outcome rather than a single bar that hides the failures.
export function BatchProgressBar({ summary, height = 8 }: BatchProgressBarProps) {
  const { total, completion } = batchProgress(summary);

  return (
    <Box
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(completion * 100)}
      aria-label={`${summary.label} progress`}
      className="flex w-full overflow-hidden rounded-full"
      sx={{ height, backgroundColor: 'action.hover' }}
    >
      {SEGMENTS.map((status) => {
        const share = total === 0 ? 0 : summary.counts[status] / total;
        if (share === 0) return null;

        return (
          <Box
            key={status}
            sx={(theme) => ({
              width: `${share * 100}%`,
              backgroundColor: theme.palette.status[status].ink,
              transition: 'width 240ms cubic-bezier(0.2, 0, 0, 1)',
            })}
          />
        );
      })}
    </Box>
  );
}
