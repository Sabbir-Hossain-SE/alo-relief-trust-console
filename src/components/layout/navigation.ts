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

// Reports whether a nav link points at the page currently being viewed.
export function isActiveRoute(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
