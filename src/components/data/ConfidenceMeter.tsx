'use client';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { CONFIDENCE_BAND_LABELS, confidenceBand, formatConfidence } from '@/domain/confidence';
import { CONFIDENCE_BAND_STATUS } from '@/theme/tokens';

type ConfidenceMeterProps = {
  score: number;
  showLabel?: boolean;
};

// Shows how much to trust an extracted value, as a bar plus a readable percentage.
export function ConfidenceMeter({ score, showLabel = true }: ConfidenceMeterProps) {
  const band = confidenceBand(score);
  const status = CONFIDENCE_BAND_STATUS[band];
  const label = `${CONFIDENCE_BAND_LABELS[band]}, ${formatConfidence(score)}`;

  return (
    <Tooltip title={label}>
      {/* Full height so it centres inside a grid cell as well as inline. */}
      <Box className="flex h-full items-center gap-2" role="img" aria-label={label}>
        <Box
          className="h-1.5 w-14 overflow-hidden rounded-full"
          sx={(theme) => ({ backgroundColor: alpha(theme.palette.status[status].fill, 0.2) })}
        >
          <Box
            className="h-full rounded-full"
            sx={(theme) => ({
              width: `${Math.round(score * 100)}%`,
              backgroundColor: theme.palette.status[status].ink,
            })}
          />
        </Box>
        {showLabel ? (
          <Typography
            variant="caption"
            className="tabular"
            sx={(theme) => ({ color: theme.palette.status[status].ink })}
          >
            {formatConfidence(score)}
          </Typography>
        ) : null}
      </Box>
    </Tooltip>
  );
}
