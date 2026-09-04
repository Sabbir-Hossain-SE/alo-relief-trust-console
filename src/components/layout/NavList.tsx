'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import { NAV_ITEMS, isActiveRoute } from './navigation';

type NavListProps = {
  /** Reduced to icons, with the labels left for assistive technology. */
  collapsed?: boolean;
  onNavigate?: () => void;
};

/**
 * The navigation links themselves, shared by the rail and the small-screen drawer.
 *
 * A collapsed label is hidden visually rather than removed. Dropping the text
 * would leave five links whose only accessible name is an icon, so the label
 * stays in the accessibility tree and a tooltip carries it for everyone else.
 */
export function NavList({ collapsed = false, onNavigate }: NavListProps) {
  const pathname = usePathname();

  return (
    <List component="nav" aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActiveRoute(href, pathname);

        return (
          <Tooltip key={href} title={collapsed ? label : ''} placement="right">
            <ListItemButton
              component={Link}
              href={href}
              selected={active}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              sx={(theme) => ({
                borderRadius: 2,
                gap: collapsed ? 0 : 1.5,
                justifyContent: collapsed ? 'center' : 'flex-start',
                px: collapsed ? 1 : 2,
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
                className={collapsed ? 'sr-only' : undefined}
                slotProps={{
                  primary: { variant: 'body2', sx: { fontWeight: active ? 600 : 400 } },
                }}
              />
            </ListItemButton>
          </Tooltip>
        );
      })}
    </List>
  );
}
