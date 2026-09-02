'use client';

import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import { ColorSchemeToggle } from './ColorSchemeToggle';

type TopBarProps = {
  onOpenNav: () => void;
};

// Slim bar holding the small-screen nav trigger and global controls.
export function TopBar({ onOpenNav }: TopBarProps) {
  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="transparent"
      sx={{
        backdropFilter: 'blur(8px)',
        backgroundColor: 'background.default',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar variant="dense" className="gap-2">
        <IconButton
          edge="start"
          onClick={onOpenNav}
          aria-label="Open navigation"
          sx={{ display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        <Box className="flex-1" />

        <ColorSchemeToggle />
      </Toolbar>
    </AppBar>
  );
}
