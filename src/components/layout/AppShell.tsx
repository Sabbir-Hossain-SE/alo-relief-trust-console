'use client';

import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';

// Frames every page: navigation rail, top bar, and the main content region.
export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <Box className="flex min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <SideNav open={navOpen} onClose={() => setNavOpen(false)} />

      <Box className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenNav={() => setNavOpen(true)} />
        <Box component="main" id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 md:px-8">
          {children}
        </Box>
      </Box>
    </Box>
  );
}
