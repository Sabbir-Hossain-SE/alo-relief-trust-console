'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { describeError, type ProcessingErrorCode } from '@/domain/errors';

/**
 * Explains a review task that exists because extraction was impossible.
 *
 * The error code is kept when a failure is handed to an operator, so the queue
 * says why this record has to be typed rather than presenting it as an ordinary
 * low-confidence result.
 */
export function ManualEntryNotice({ errorCode }: { errorCode: ProcessingErrorCode }) {
  const spec = describeError(errorCode);

  return (
    <Box
      className="flex flex-col gap-1 rounded-lg p-3"
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.status.needs_review.fill, 0.1),
        border: `1px solid ${alpha(theme.palette.status.needs_review.fill, 0.3)}`,
      })}
    >
      <Typography variant="body2" sx={{ color: 'status.needs_review.ink', fontWeight: 600 }}>
        Waiting for manual entry
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {spec.title} — {spec.detail} The details have to be entered by hand.
      </Typography>
    </Box>
  );
}
