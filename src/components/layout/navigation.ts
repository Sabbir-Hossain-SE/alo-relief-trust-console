import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import type { SvgIconComponent } from '@mui/icons-material';

export type NavItem = {
  href: string;
  label: string;
  icon: SvgIconComponent;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Overview', icon: SpaceDashboardOutlinedIcon },
  { href: '/upload', label: 'Upload', icon: CloudUploadOutlinedIcon },
  { href: '/batches', label: 'Batches', icon: LayersOutlinedIcon },
  { href: '/documents', label: 'Documents', icon: DescriptionOutlinedIcon },
  { href: '/review', label: 'Review queue', icon: RateReviewOutlinedIcon },
];

/** The bar spans the full width, so everything below it is offset by this. */
export const TOP_BAR_HEIGHT = 56;

/** Wide enough for a label. */
export const NAV_WIDTH = 248;

/**
 * Narrow enough to be a rail, wide enough for a 40px target with room around it.
 * Below about 64 the icons stop reading as a column and start reading as a border.
 */
export const NAV_RAIL_WIDTH = 72;

// Reports whether a nav link points at the page currently being viewed.
export function isActiveRoute(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
