'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ReplayIcon from '@mui/icons-material/Replay';
import { alpha } from '@mui/material/styles';
import { describeError, isRetryable, type ProcessingErrorCode } from '@/domain/errors';

type FailureNoticeProps = {
  errorCode: ProcessingErrorCode;
  attempts: number;
  onRetry?: () => void;
  isRetrying?: boolean;
};

/**
 * Explains a failure and offers the one action that can help.
 *
 * Retry is shown only where a second attempt could plausibly succeed. Offering
 * it on an unsupported format wastes an operator's time and hides the real
 * remedy, so those cases show the remedy instead of a button that cannot work.
 */
export function FailureNotice({ errorCode, attempts, onRetry, isRetrying }: FailureNoticeProps) {
  const spec = describeError(errorCode);
  const retryable = isRetryable(errorCode);

  return (
    <Box
      className="flex flex-col gap-2 rounded-lg p-3"
      role="alert"
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.status.failed.fill, 0.1),
        border: `1px solid ${alpha(theme.palette.status.failed.fill, 0.3)}`,
      })}
    >
      <Typography variant="body2" sx={{ color: 'status.failed.ink', fontWeight: 600 }}>
        {spec.title}
      </Typography>

      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {spec.detail}
      </Typography>

      <Typography variant="body2">{spec.remedy}</Typography>

      <Box className="flex items-center justify-between gap-2 pt-1">
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {attempts === 1 ? '1 attempt' : `${attempts} attempts`}
        </Typography>

        {retryable && onRetry ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<ReplayIcon />}
            onClick={onRetry}
            loading={isRetrying}
          >
            Retry
          </Button>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Retrying will not help
          </Typography>
        )}
      </Box>
    </Box>
  );
}
