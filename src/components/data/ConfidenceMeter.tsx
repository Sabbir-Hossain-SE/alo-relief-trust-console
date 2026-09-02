'use client';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import {
  CONFIDENCE_BAND_LABELS,
  confidenceBand,
  formatConfidence,
  type ConfidenceBand,
} from '@/domain/confidence';

const BAND_COLORS: Record<ConfidenceBand, string> = {
  high: '#5C8A6E',
  medium: '#D99A4E',
  low: '#C4685A',
};

type ConfidenceMeterProps = {
  score: number;
  showLabel?: boolean;
};

// Shows how much to trust an extracted value, as a bar plus a readable percentage.
export function ConfidenceMeter({ score, showLabel = true }: ConfidenceMeterProps) {
  const band = confidenceBand(score);
  const color = BAND_COLORS[band];
  const label = `${CONFIDENCE_BAND_LABELS[band]}, ${formatConfidence(score)}`;

  return (
    <Tooltip title={label}>
      <Box className="flex items-center gap-2" role="img" aria-label={label}>
        <Box
          className="h-1.5 w-14 overflow-hidden rounded-full"
          sx={{ backgroundColor: alpha(color, 0.2) }}
        >
          <Box
            className="h-full rounded-full"
            sx={{ width: `${Math.round(score * 100)}%`, backgroundColor: color }}
          />
        </Box>
        {showLabel ? (
          <Typography variant="caption" className="tabular" sx={{ color }}>
            {formatConfidence(score)}
          </Typography>
        ) : null}
      </Box>
    </Tooltip>
  );
}
