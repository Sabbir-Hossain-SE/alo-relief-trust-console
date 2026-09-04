'use client';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { ActionOutcome } from '@/components/feedback/ActionOutcome';
import { ProgressAnnouncer, decile } from '@/components/feedback/ProgressAnnouncer';
import { formatBytes, formatCount } from '@/lib/format/number';
import { exportFraction, type ExportState } from '../useCsvExport';

/** What the operator is told once the export stops, one line, in their terms. */
function outcomeOf(state: ExportState): string | null {
  switch (state.status) {
    case 'done':
      return state.rows === 0
        ? 'Nothing matches these filters, so no file was saved.'
        : `${formatCount(state.rows)} ${state.rows === 1 ? 'document' : 'documents'} exported.`;
    case 'cancelled':
      return 'Export cancelled. Nothing was saved.';
    case 'failed':
      return state.message;
    default:
      return null;
  }
}

/**
 * Reports an export while it runs and says how it ended.
 *
 * The bar is indeterminate until the response says how large the file is,
 * because a percentage invented from an unknown total is worse than one that
 * admits it — the same rule the folder walk follows.
 */
export function ExportProgress({ state }: { state: ExportState }) {
  const outcome = outcomeOf(state);

  if (state.status === 'running') {
    const fraction = exportFraction(state);
    const percent = fraction === null ? null : Math.round(fraction * 100);

    return (
      <Box className="flex flex-col gap-1.5">
        <Typography variant="caption" className="figures" sx={{ color: 'text.secondary' }}>
          Preparing the file · {formatBytes(state.received)}
          {percent === null ? '' : ` of ${formatBytes(state.total ?? 0)} · ${percent}%`}
        </Typography>

        <LinearProgress
          aria-label="Preparing the export"
          variant={fraction === null ? 'indeterminate' : 'determinate'}
          value={percent ?? 0}
          sx={{ maxWidth: 420 }}
        />

        <ProgressAnnouncer
          step={decile(fraction ?? 0)}
          message={`Export ${percent ?? 0}% prepared.`}
        />
      </Box>
    );
  }

  if (outcome === null) return null;

  return <ActionOutcome lines={[outcome]} />;
}
