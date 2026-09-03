'use client';

import { useMemo, type ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { createAppTheme } from './theme';
import { useReducedMotion } from './useReducedMotion';

// Wraps the app in the Daylight theme, with Emotion output confined to the mui layer.
export function ThemeRegistry({ children }: { children: ReactNode }) {
  // Built from the preference rather than imported as a constant, so one place
  // settles Drawer, Tooltip, Select, Skeleton and the ripple together.
  const reduceMotion = useReducedMotion();
  const theme = useMemo(() => createAppTheme({ reduceMotion }), [reduceMotion]);

  return (
    <AppRouterCacheProvider options={{ key: 'mui', enableCssLayer: true }}>
      <ThemeProvider theme={theme} defaultMode="system">
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
