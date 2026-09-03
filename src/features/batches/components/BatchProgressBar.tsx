'use client';

import Box from '@mui/material/Box';
import { STATUS_LABELS, type ProcessingStatus } from '@/domain/status';
import { formatCount } from '@/lib/format/number';
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

/**
 * States the split in words.
 *
 * The segments are distinguishable only by hue, so on their own they carry
 * nothing for a screen reader and nothing for anyone who cannot tell terracotta
 * from sage. `aria-valuenow` reports overall completion and hides the outcome.
 */
function describeSplit(summary: BatchSummary): string {
  const parts = SEGMENTS.filter((status) => summary.counts[status] > 0).map(
    (status) => `${formatCount(summary.counts[status])} ${STATUS_LABELS[status].toLowerCase()}`,
  );

  return parts.length === 0 ? 'Nothing processed yet.' : `${parts.join(', ')}.`;
}

// Progress split by outcome rather than a single bar that hides the failures.
export function BatchProgressBar({ summary, height = 8 }: BatchProgressBarProps) {
  const { total, completion } = batchProgress(summary);

  return (
    <Box
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(completion * 100)}
      aria-label={`${summary.label} progress. ${describeSplit(summary)}`}
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
