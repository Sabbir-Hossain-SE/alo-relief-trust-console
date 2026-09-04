'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import { NAV_ITEMS, WHEN_NAV_COLLAPSED, isActiveRoute } from './navigation';

/** Out of the layout and off screen, still in the accessibility tree. */
const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

type NavListProps = {
  /**
   * Set on the rail, which can be reduced to icons; left unset in the drawer.
   *
   * The rail's layout does not read the value. It follows the document's
   * collapsed mark, written from storage before the first paint, where React
   * only learns the preference after hydration — laid out from React alone,
   * the rail was drawn wide and animated shut on every load. The value is
   * still needed for what CSS cannot decide: whether a tooltip should repeat
   * the label.
   */
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
export function NavList({ collapsed, onNavigate }: NavListProps) {
  const pathname = usePathname();
  const collapsible = collapsed !== undefined;

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
                gap: 1.5,
                justifyContent: 'flex-start',
                px: 2,
                '&.Mui-selected': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.14) },
                },
                ...(collapsible
                  ? { [WHEN_NAV_COLLAPSED]: { gap: 0, justifyContent: 'center', px: 1 } }
                  : {}),
              })}
            >
              <ListItemIcon sx={{ minWidth: 0, color: 'inherit' }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={label}
                sx={collapsible ? { [WHEN_NAV_COLLAPSED]: VISUALLY_HIDDEN } : undefined}
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
