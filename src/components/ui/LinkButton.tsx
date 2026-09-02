'use client';

import Link from 'next/link';
import Button, { type ButtonProps } from '@mui/material/Button';

type LinkButtonProps = Omit<ButtonProps<'a'>, 'component' | 'href'> & { href: string };

// Button that navigates through the client router, usable from server components.
export function LinkButton({ href, ...props }: LinkButtonProps) {
  return <Button component={Link} href={href} {...props} />;
}
