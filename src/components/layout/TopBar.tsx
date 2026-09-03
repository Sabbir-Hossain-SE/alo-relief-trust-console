'use client';

import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import { BrandMark } from './BrandMark';
import { ColorSchemeToggle } from './ColorSchemeToggle';
import { TOP_BAR_HEIGHT } from './navigation';

type TopBarProps = {
  navCollapsed: boolean;
  /** Desktop: narrows the rail. */
  onToggleNav: () => void;
  /** Small screens: opens the drawer, since there is no rail to narrow. */
  onOpenNav: () => void;
};

/**
 * The full-width bar across the top of every screen.
 *
 * It spans the navigation as well as the content, so the brand and the control
 * that collapses the rail sit in one fixed place rather than moving with the
 * thing they act on.
 */
export function TopBar({ navCollapsed, onToggleNav, onOpenNav }: TopBarProps) {
  const toggleLabel = navCollapsed ? 'Expand navigation' : 'Collapse navigation';

  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="transparent"
      sx={{
        // Left at the default, below a temporary drawer: on a small screen the
        // drawer overlays the page, and the bar sitting above its scrim would
        // put an unreachable control on top of a modal.
        backdropFilter: 'blur(8px)',
        backgroundColor: 'background.default',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar className="gap-2" sx={{ minHeight: TOP_BAR_HEIGHT, height: TOP_BAR_HEIGHT }}>
        <IconButton
          edge="start"
          onClick={onOpenNav}
          aria-label="Open navigation"
          sx={{ display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        <Tooltip title={toggleLabel}>
          <IconButton
            edge="start"
            onClick={onToggleNav}
            aria-label={toggleLabel}
            aria-expanded={!navCollapsed}
            aria-controls="main-navigation"
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            {navCollapsed ? <MenuIcon /> : <MenuOpenIcon />}
          </IconButton>
        </Tooltip>

        <BrandMark compact />

        <Box className="flex-1" />

        <ColorSchemeToggle />
      </Toolbar>
    </AppBar>
  );
}
