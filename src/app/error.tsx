'use client';

import { useEffect } from 'react';
import Button from '@mui/material/Button';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import Link from 'next/link';
import { CrashNotice } from '@/components/feedback/CrashNotice';

/**
 * The route-level boundary.
 *
 * It renders inside the root layout, so the bar and the navigation survive a
 * crashed page and the operator can walk to another screen instead of being
 * handed the browser's own error page with nothing on it but Reload and Back.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The one place a thrown error is worth logging: it reached a boundary,
    // which means nothing below handled it.
    console.error('Unhandled error in route', error);
  }, [error]);

  return (
    <CrashNotice
      onRetry={reset}
      detail={error.digest === undefined ? error.message : `${error.message} · ${error.digest}`}
      action={
        <Button component={Link} href="/" variant="outlined" startIcon={<HomeOutlinedIcon />}>
          Go to the overview
        </Button>
      }
    />
  );
}
