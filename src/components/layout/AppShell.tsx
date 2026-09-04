'use client';

import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import { StickyBatchBar } from '@/features/batches/StickyBatchBar';
import { setNavCollapsed } from '@/store/preferences';
import { useAppDispatch } from '@/store/hooks';
import { usePreferences } from '@/store/usePreferences';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';
import { useWindowDropGuard } from './useWindowDropGuard';

/**
 * Frames every page: a full-width bar, then the navigation rail beside the
 * content region.
 *
 * The bar spans both columns rather than sitting inside the content one. The
 * brand and the control that collapses the rail belong to the application, not
 * to the page, and putting them above everything keeps them in one place while
 * the rail changes width underneath.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const { navCollapsed } = usePreferences();
  const dispatch = useAppDispatch();

  useWindowDropGuard();

  return (
    <Box className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <TopBar
        navCollapsed={navCollapsed}
        onToggleNav={() => dispatch(setNavCollapsed(!navCollapsed))}
        onOpenNav={() => setNavOpen(true)}
      />

      <Box className="flex flex-1">
        <SideNav collapsed={navCollapsed} open={navOpen} onClose={() => setNavOpen(false)} />

        <Box className="flex min-w-0 flex-1 flex-col">
          <Box
            component="main"
            id="main-content"
            tabIndex={-1}
            className="flex-1 px-4 py-6 md:px-8"
          >
            {children}
          </Box>

          <StickyBatchBar />
        </Box>
      </Box>
    </Box>
  );
}
