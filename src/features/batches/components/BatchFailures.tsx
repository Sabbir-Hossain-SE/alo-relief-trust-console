'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import { alpha } from '@mui/material/styles';
import { ActionOutcome } from '@/components/feedback/ActionOutcome';
import { formatCount } from '@/lib/format/number';
import type { BatchSummary } from '@/server/simulator/batch';
import { useRetryBatchMutation, useSendBatchToManualEntryMutation } from '@/store/api';
import { FailureCause } from './FailureCause';

// States what the actions did, including what they deliberately left alone.
function outcomeLines(
  retry: { retried: number; skipped: number } | undefined,
  manual: { moved: number; skipped: number } | undefined,
): string[] {
  const lines: string[] = [];

  if (retry !== undefined) {
    const skipped =
      retry.skipped > 0
        ? ` · ${formatCount(retry.skipped)} skipped, a retry cannot clear them`
        : '';
    lines.push(`${formatCount(retry.retried)} queued for another attempt${skipped}`);
  }

  if (manual !== undefined) {
    lines.push(`${formatCount(manual.moved)} moved to the review queue for manual entry`);
  }

  return lines;
}

/**
 * Every failure in a batch, grouped by cause, with the route out of each.
 *
 * A single "17 failed" with one retry button would be dishonest here: five of
 * those may be unsupported formats that no retry can clear. Splitting by cause
 * is what lets the two actions offer real numbers.
 */
export function BatchFailures({ summary }: { summary: BatchSummary }) {
  const [retryBatch, retryState] = useRetryBatchMutation();
  const [sendToManualEntry, manualState] = useSendBatchToManualEntryMutation();

  if (summary.counts.failed === 0) return null;

  const manual = summary.counts.failed - summary.retryableFailures;
  const busy = retryState.isLoading || manualState.isLoading;

  return (
    <Paper className="flex flex-col gap-3 p-5">
      <Box className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Typography variant="h3" component="h2">
          {formatCount(summary.counts.failed)}{' '}
          {summary.counts.failed === 1 ? 'failure' : 'failures'}
        </Typography>

        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {formatCount(summary.retryableFailures)} can be retried · {formatCount(manual)} need an
          operator
        </Typography>
      </Box>

      <Box
        className="flex flex-col rounded-lg py-1"
        sx={(theme) => ({ backgroundColor: alpha(theme.palette.status.failed.fill, 0.07) })}
      >
        {summary.failures.map((group) => (
          <FailureCause key={group.code} batchId={summary.id} group={group} />
        ))}
      </Box>

      <Box className="flex flex-wrap items-center gap-2">
        <Button
          variant="contained"
          startIcon={<ReplayIcon />}
          disabled={summary.retryableFailures === 0 || busy}
          loading={retryState.isLoading}
          onClick={() => void retryBatch({ id: summary.id })}
        >
          Retry {formatCount(summary.retryableFailures)}
        </Button>

        <Button
          variant="outlined"
          startIcon={<EditNoteOutlinedIcon />}
          disabled={manual === 0 || busy}
          loading={manualState.isLoading}
          onClick={() => void sendToManualEntry(summary.id)}
        >
          Enter {formatCount(manual)} by hand
        </Button>
      </Box>

      <ActionOutcome lines={outcomeLines(retryState.data, manualState.data)} />
    </Paper>
  );
}
