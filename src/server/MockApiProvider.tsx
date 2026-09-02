'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { ErrorState } from '@/components/feedback/ErrorState';
import { startMockApi } from './browser';

type BootState = 'starting' | 'ready' | 'failed';

/**
 * Holds page content back until the mock backend is intercepting.
 *
 * Requests issued before the service worker activates fall straight through to
 * a real 404, which surfaces as a confusing empty screen on first load. The
 * navigation renders immediately regardless, so only the data-backed region
 * waits.
 */
export function MockApiProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BootState>('starting');

  useEffect(() => {
    let cancelled = false;

    startMockApi().then(
      () => {
        if (!cancelled) setState('ready');
      },
      () => {
        if (!cancelled) setState('failed');
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'failed') {
    return (
      <ErrorState
        title="The demo backend did not start"
        description="This prototype serves its data from a service worker in your browser. It could not be registered, which usually means the page is running from a context that blocks service workers."
        onRetry={() => window.location.reload()}
        retryLabel="Reload"
      />
    );
  }

  if (state === 'starting') {
    return (
      <Box className="flex flex-col items-center justify-center gap-3 py-24" aria-live="polite">
        <CircularProgress size={24} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Preparing the archive…
        </Typography>
      </Box>
    );
  }

  return children;
}
