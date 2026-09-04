'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import { CONFIDENCE_BAND_LABELS, type ConfidenceBand } from '@/domain/confidence';
import { PROCESSING_STATUSES, STATUS_LABELS, type ProcessingStatus } from '@/domain/status';

const BANDS: ConfidenceBand[] = ['high', 'medium', 'low'];

/**
 * Short enough to sit on one line beside the status chips. The accessible name
 * stays the full phrase, because "High" on its own names nothing an operator
 * could act on and the group's own label is not announced with every chip.
 */
const BAND_SHORT_LABELS: Record<ConfidenceBand, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

type StatusChipsProps = {
  selected: readonly ProcessingStatus[];
  onToggle: (status: ProcessingStatus) => void;
};

export function StatusFilterChips({ selected, onToggle }: StatusChipsProps) {
  return (
    <Box className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
      {PROCESSING_STATUSES.map((status) => {
        const on = selected.includes(status);

        return (
          <Chip
            key={status}
            label={STATUS_LABELS[status]}
            size="small"
            variant={on ? 'filled' : 'outlined'}
            onClick={() => onToggle(status)}
            aria-pressed={on}
            sx={(theme) => ({
              color: theme.palette.status[status].ink,
              borderColor: alpha(theme.palette.status[status].fill, 0.4),
              backgroundColor: on ? alpha(theme.palette.status[status].fill, 0.18) : 'transparent',
            })}
          />
        );
      })}
    </Box>
  );
}

type ConfidenceChipsProps = {
  selected: readonly ConfidenceBand[];
  onToggle: (band: ConfidenceBand) => void;
};

export function ConfidenceFilterChips({ selected, onToggle }: ConfidenceChipsProps) {
  return (
    // Its own group. These sat inside "Filter by status", so every confidence
    // chip was announced as a status filter.
    <Box
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Filter by confidence"
    >
      {BANDS.map((band) => {
        const on = selected.includes(band);

        return (
          <Chip
            key={band}
            label={BAND_SHORT_LABELS[band]}
            aria-label={CONFIDENCE_BAND_LABELS[band]}
            size="small"
            variant={on ? 'filled' : 'outlined'}
            onClick={() => onToggle(band)}
            aria-pressed={on}
          />
        );
      })}
    </Box>
  );
}
