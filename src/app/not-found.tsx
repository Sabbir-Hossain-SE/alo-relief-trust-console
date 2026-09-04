'use client';

import Button from '@mui/material/Button';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import Link from 'next/link';
import { EmptyState } from '@/components/feedback/EmptyState';

/**
 * A route that does not exist, said in the console's own voice.
 *
 * Every other dead end here names the problem and offers a way out. Next's
 * stock page inside the shell did neither, in a typeface from nowhere else.
 */
export default function NotFound() {
  return (
    <EmptyState
      title="There is no page here"
      description="The address may have been mistyped, or it points at a page that has moved."
      action={
        <Button component={Link} href="/" variant="outlined" startIcon={<HomeOutlinedIcon />}>
          Go to the overview
        </Button>
      }
    />
  );
}
