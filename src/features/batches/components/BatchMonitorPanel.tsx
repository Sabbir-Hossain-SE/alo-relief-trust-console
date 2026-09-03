'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { formatDateTime } from '@/lib/format/date';
import { formatCount, formatPercent } from '@/lib/format/number';
import type { BatchSummary } from '@/server/simulator/batch';
import { BatchProgressBar } from './BatchProgressBar';
import { batchProgress, remainingLabel, throughputLabel } from '../progress';

/**
 * One frame, whatever the batch is doing.
 *
 * Loading, running and settled all render the same structure at the same
 * height, so watching a batch finish never moves anything under the cursor.
 */
const FRAME_HEIGHT = 156;

// Names the phase in words, so the bar is not the only thing carrying it.
function phaseOf(summary: BatchSummary): string {
  if (summary.settled) return 'Finished';
  return summary.counts.processing > 0 ? 'Processing' : 'Queued';
}

function metaLine(summary: BatchSummary): string {
  const { finished, total, running, queued } = batchProgress(summary);

  const parts = [
    `${formatCount(finished)} of ${formatCount(total)} processed`,
    `${formatPercent(finished, total)}`,
  ];

  if (!summary.settled) {
    parts.push(`${formatCount(running)} running`, `${formatCount(queued)} queued`);
  }

  const rate = throughputLabel(summary.throughput);
  if (rate !== null) parts.push(rate);

  const remaining = remainingLabel(summary);
  if (remaining !== null) parts.push(remaining);

  return parts.join(' · ');
}

// The headline block of a batch: what it is, how far along, and how it is going.
export function BatchMonitorPanel({ summary }: { summary: BatchSummary | undefined }) {
  return (
    <Paper className="flex flex-col justify-between gap-4 p-6" sx={{ minHeight: FRAME_HEIGHT }}>
      <Box className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Typography variant="h3" component="h2" className="min-w-0 truncate">
          {summary?.label ?? <Skeleton variant="text" width={220} />}
        </Typography>

        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {summary === undefined
            ? null
            : `${phaseOf(summary)} · started ${formatDateTime(summary.createdAt)}`}
        </Typography>
      </Box>

      <Typography variant="body2" className="figures" sx={{ color: 'text.secondary' }}>
        {summary === undefined ? <Skeleton variant="text" width={420} /> : metaLine(summary)}
      </Typography>

      {summary === undefined ? (
        <Skeleton variant="rounded" height={8} />
      ) : (
        <BatchProgressBar summary={summary} />
      )}
    </Paper>
  );
}
