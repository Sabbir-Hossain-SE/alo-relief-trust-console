'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { REJECTION_LABELS } from '@/lib/file-ingest/validate';
import type { IngestProgress, IngestResult, RejectionReason } from '@/lib/file-ingest/types';
import { formatCount } from '@/lib/format/number';
import { UploadPanel } from './UploadPanel';

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
    <UploadPanel>
      <Typography variant="h2" component="p" className="figures">
        {formatCount(progress.scanned)}
      </Typography>

      {/* Announced politely: this can run for a while on a large folder, and a
          screen reader user needs to know it is still working. */}
      <Typography variant="body2" sx={{ color: 'text.secondary' }} aria-live="polite">
        files indexed so far
      </Typography>

      {/* Indeterminate on purpose: the total is unknown until the walk ends, and
          a bar that invents a percentage is worse than one that admits it. */}
      <LinearProgress sx={{ width: '100%', maxWidth: 320, mt: 1 }} />

      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {formatCount(progress.accepted)} accepted · {formatCount(progress.rejected)} skipped
      </Typography>

      <Button size="small" onClick={onCancel} sx={{ mt: 1 }}>
        Cancel
      </Button>
    </UploadPanel>
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
    <UploadPanel>
      <CheckCircleOutlinedIcon sx={{ fontSize: 36, color: 'status.completed.ink' }} />

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
          <Box className="mt-0.5 flex flex-col gap-0.5">
            {groups.map(([reason, count]) => (
              <Typography key={reason} variant="body2" sx={{ color: 'text.secondary' }}>
                {formatCount(count)} · {REJECTION_LABELS[reason]}
              </Typography>
            ))}
          </Box>
        </Box>
      ) : null}

      <Box className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="contained"
          onClick={onStart}
          loading={isStarting}
          disabled={result.accepted === 0}
        >
          Start processing
        </Button>
        <Button variant="outlined" onClick={onDiscard}>
          Choose different files
        </Button>
      </Box>
    </UploadPanel>
  );
}
