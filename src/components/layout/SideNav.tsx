'use client';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import { BrandMark } from './BrandMark';
import { NavList } from './NavList';
import { NAV_RAIL_WIDTH, NAV_WIDTH, TOP_BAR_HEIGHT, WHEN_NAV_COLLAPSED } from './navigation';

type SideNavProps = {
  /**
   * Reduced to an icon rail. Desktop only — a drawer is already all or nothing.
   *
   * The rail's width does not read this; it follows the document's mark, which
   * is set before the first paint. This is what React knows, for the tooltips.
   */
  collapsed: boolean;
  open: boolean;
  onClose: () => void;
};

/**
 * Primary navigation: a rail below the bar on desktop, a dismissible drawer on
 * small screens.
 *
 * Laid out in the flow rather than as a permanent MUI Drawer, which is fixed to
 * the viewport and would have to be pushed down past a full-width bar by hand.
 * Sticky keeps it in view while the page scrolls; the flex row does the rest.
 */
export function SideNav({ collapsed, open, onClose }: SideNavProps) {
  return (
    <>
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Box className="flex h-full flex-col gap-2 p-4">
          {/* The bar is behind the overlay here, so the drawer carries the mark
              itself rather than leaving the panel unattributed. */}
          <Box className="px-2 py-1">
            <BrandMark />
          </Box>
          <NavList onNavigate={onClose} />
        </Box>
      </Drawer>

      <Box
        component="aside"
        id="main-navigation"
        sx={{
          display: { xs: 'none', md: 'block' },
          flexShrink: 0,
          width: NAV_WIDTH,
          [WHEN_NAV_COLLAPSED]: { width: NAV_RAIL_WIDTH },
          position: 'sticky',
          top: TOP_BAR_HEIGHT,
          alignSelf: 'flex-start',
          height: `calc(100vh - ${TOP_BAR_HEIGHT}px)`,
          // The visible viewport where the browser can say: on a tablet, vh
          // includes the strip behind the address bar and the rail ran under it.
          '@supports (height: 1dvh)': { height: `calc(100dvh - ${TOP_BAR_HEIGHT}px)` },
          overflowY: 'auto',
          borderRight: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.default',
          // Timed from the theme, which collapses every duration to nothing when
          // the operator has asked for reduced motion.
          transition: (theme) => theme.transitions.create('width'),
        }}
      >
        <Box className="p-3">
          <NavList collapsed={collapsed} />
        </Box>
      </Box>
    </>
  );
}
