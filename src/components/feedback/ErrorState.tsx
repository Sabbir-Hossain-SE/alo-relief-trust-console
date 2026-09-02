'use client';

import Button from '@mui/material/Button';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { StateView } from './StateView';

type ErrorStateProps = {
  title?: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
};

// Explains what failed and offers the next step, rather than a bare failure notice.
export function ErrorState({
  title = 'Something failed',
  description,
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  return (
    <StateView
      tone="error"
      icon={<ErrorOutlinedIcon fontSize="inherit" />}
      title={title}
      description={description}
      action={
        onRetry ? (
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null
      }
    />
  );
}
