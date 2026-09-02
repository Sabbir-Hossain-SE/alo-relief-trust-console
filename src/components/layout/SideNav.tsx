'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { alpha } from '@mui/material/styles';
import { BrandMark } from './BrandMark';
import { NAV_ITEMS, isActiveRoute } from './navigation';

export const NAV_WIDTH = 248;

type SideNavProps = {
  open: boolean;
  onClose: () => void;
};

// Primary navigation: a fixed rail on desktop, a dismissible drawer on small screens.
export function SideNav({ open, onClose }: SideNavProps) {
  const pathname = usePathname();

  const content = (
    <Box className="flex h-full flex-col gap-2 p-4">
      <Box className="px-2 py-3">
        <BrandMark />
      </Box>

      <List component="nav" aria-label="Main" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActiveRoute(href, pathname);

          return (
            <ListItemButton
              key={href}
              component={Link}
              href={href}
              selected={active}
              onClick={onClose}
              aria-current={active ? 'page' : undefined}
              sx={(theme) => ({
                borderRadius: 2,
                gap: 1.5,
                '&.Mui-selected': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.14) },
                },
              })}
            >
              <ListItemIcon sx={{ minWidth: 0, color: 'inherit' }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={label}
                slotProps={{
                  primary: { variant: 'body2', sx: { fontWeight: active ? 600 : 400 } },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

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
        {content}
      </Drawer>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: NAV_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: NAV_WIDTH,
            boxSizing: 'border-box',
            backgroundColor: 'background.default',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {content}
      </Drawer>
    </>
  );
}
