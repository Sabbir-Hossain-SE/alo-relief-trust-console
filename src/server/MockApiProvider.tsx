'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { ErrorState } from '@/components/feedback/ErrorState';
import { startMockApi } from './browser';

type BootState = 'starting' | 'ready' | 'failed';

const BootContext = createContext<BootState>('starting');

/**
 * Reports whether the mock backend is intercepting yet.
 *
 * Anything that fetches from outside the gated region — the shell's own batch
 * bar, for one — has to wait for this. A request issued earlier passes straight
 * through the service worker and comes back as a real 404.
 */
export function useMockApiReady(): boolean {
  return useContext(BootContext) === 'ready';
}

/** Starts the mock backend once and publishes how far along it is. */
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

  return <BootContext.Provider value={state}>{children}</BootContext.Provider>;
}

/**
 * Holds data-backed content back until the mock backend is intercepting.
 *
 * Only the page waits. The navigation and the shell render immediately, so the
 * first paint is the application rather than a full-screen spinner.
 */
export function MockApiGate({ children }: { children: ReactNode }) {
  const state = useContext(BootContext);

  if (state === 'failed') {
    return (
      <ErrorState
        title="The demo backend did not start"
        description="This prototype serves its data from a service worker in your browser. It could not be registered. Service workers need a secure page — https, or localhost — and some private windows and older browsers turn them off."
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
