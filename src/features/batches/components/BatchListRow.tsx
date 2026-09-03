'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { STATUS_LABELS, type ProcessingStatus } from '@/domain/status';
import { formatDateTime } from '@/lib/format/date';
import { formatCount, formatPercent } from '@/lib/format/number';
import type { BatchSummary } from '@/server/simulator/batch';
import { BatchProgressBar } from './BatchProgressBar';
import { batchHref } from '../links';
import { batchProgress, remainingLabel } from '../progress';

const OUTCOMES: readonly ProcessingStatus[] = ['completed', 'processing', 'failed', 'needs_review'];

// One batch in the list: enough to judge it without opening it.
export function BatchListRow({ summary }: { summary: BatchSummary }) {
  const { finished, total } = batchProgress(summary);
  const remaining = remainingLabel(summary);

  return (
    <Paper
      component={Link}
      href={batchHref(summary.id)}
      className="flex flex-col gap-3 p-5"
      sx={{
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 200ms',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <Box className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Typography variant="h3" component="h2" className="min-w-0 truncate">
          {summary.label}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {formatDateTime(summary.createdAt)}
        </Typography>
      </Box>

      <Typography variant="body2" className="figures" sx={{ color: 'text.secondary' }}>
        {formatCount(finished)} of {formatCount(total)} processed · {formatPercent(finished, total)}
        {summary.settled ? '' : remaining === null ? ' · running' : ` · ${remaining}`}
      </Typography>

      <BatchProgressBar summary={summary} height={6} />

      <Box className="flex flex-wrap gap-x-5 gap-y-1">
        {OUTCOMES.map((status) => (
          <Typography key={status} variant="caption" sx={{ color: 'text.secondary' }}>
            <Box
              component="span"
              className="figures font-semibold"
              sx={(theme) => ({ color: theme.palette.status[status].ink })}
            >
              {formatCount(summary.counts[status])}
            </Box>{' '}
            {STATUS_LABELS[status].toLowerCase()}
          </Typography>
        ))}
      </Box>
    </Paper>
  );
}
