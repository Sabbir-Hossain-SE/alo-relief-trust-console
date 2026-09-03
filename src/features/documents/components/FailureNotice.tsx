'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import { alpha } from '@mui/material/styles';
import { describeError, isRetryable, type ProcessingErrorCode } from '@/domain/errors';

type FailureNoticeProps = {
  errorCode: ProcessingErrorCode;
  attempts: number;
  onRetry: () => void;
  onManualEntry: () => void;
  isRetrying?: boolean;
  isSending?: boolean;
};

/**
 * Explains a failure and offers the one action that can help.
 *
 * Retry is shown only where a second attempt could plausibly succeed. Where it
 * cannot, the document is not a dead end either: it is handed to an operator to
 * enter by hand, which is the real remedy rather than a button that will fail
 * again.
 */
export function FailureNotice({
  errorCode,
  attempts,
  onRetry,
  onManualEntry,
  isRetrying,
  isSending,
}: FailureNoticeProps) {
  const spec = describeError(errorCode);
  const retryable = isRetryable(errorCode);

  return (
    <Box
      className="flex flex-col gap-2 rounded-lg p-3"
      // Not an alert. It describes the record being read rather than reporting
      // an event, and asserting it would interrupt the reader every time a
      // failed document is opened. Actions announce themselves separately.
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

      <Box className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {attempts === 1 ? '1 attempt' : `${attempts} attempts`}
        </Typography>

        {retryable ? (
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
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditNoteOutlinedIcon />}
            onClick={onManualEntry}
            loading={isSending}
          >
            Enter by hand
          </Button>
        )}
      </Box>
    </Box>
  );
}
