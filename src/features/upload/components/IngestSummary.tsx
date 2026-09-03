'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { REJECTION_LABELS } from '@/lib/file-ingest/validate';
import type { IngestProgress, IngestResult, RejectionReason } from '@/lib/file-ingest/types';
import { formatCount } from '@/lib/format/number';

// Groups rejections so the operator sees "200 spreadsheets", not 200 rows.
function groupRejections(result: IngestResult): [RejectionReason, number][] {
  const counts = new Map<RejectionReason, number>();

  for (const rejection of result.rejections) {
    counts.set(rejection.reason, (counts.get(rejection.reason) ?? 0) + 1);
  }

  return [...counts.entries()];
}

export function IndexingProgress({
  progress,
  onCancel,
}: {
  progress: IngestProgress;
  onCancel: () => void;
}) {
  return (
    <Paper className="flex flex-col gap-3 p-4">
      <Box className="flex flex-wrap items-center justify-between gap-2">
        {/* Announced politely: this can run for a while on a large folder, and
            a screen reader user needs to know it is still working. */}
        <Typography variant="body2" aria-live="polite">
          Indexing {formatCount(progress.scanned)} files…
        </Typography>

        <Button size="small" onClick={onCancel}>
          Cancel
        </Button>
      </Box>

      {/* Indeterminate on purpose: the total is unknown until the walk ends, and
          a bar that invents a percentage is worse than one that admits it. */}
      <LinearProgress />

      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {formatCount(progress.accepted)} accepted · {formatCount(progress.rejected)} skipped
      </Typography>
    </Paper>
  );
}

export function IngestSummary({
  result,
  onStart,
  onDiscard,
  isStarting,
}: {
  result: IngestResult;
  onStart: () => void;
  onDiscard: () => void;
  isStarting: boolean;
}) {
  const groups = groupRejections(result);

  return (
    <Paper className="flex flex-col gap-4 p-4">
      <Box>
        <Typography variant="h2" component="p" className="figures">
          {formatCount(result.accepted)}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {result.accepted === 1 ? 'document ready to upload' : 'documents ready to upload'}
          {result.cancelled ? ' · indexing was cancelled, so this may be partial' : ''}
        </Typography>
      </Box>

      {groups.length > 0 ? (
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Skipped {formatCount(result.rejected)}
          </Typography>
          <Box className="mt-1 flex flex-col gap-0.5">
            {groups.map(([reason, count]) => (
              <Typography key={reason} variant="body2">
                {formatCount(count)} · {REJECTION_LABELS[reason]}
              </Typography>
            ))}
          </Box>
        </Box>
      ) : null}

      <Box className="flex flex-wrap items-center gap-2">
        <Button
          variant="contained"
          onClick={onStart}
          loading={isStarting}
          disabled={result.accepted === 0}
        >
          Start processing
        </Button>
        <Button onClick={onDiscard}>Choose different files</Button>
      </Box>
    </Paper>
  );
}
