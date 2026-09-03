'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * Says what the last action did.
 *
 * Kept outside the thing it acted on, because a successful action usually
 * changes that thing's state and the notice would unmount along with it — which
 * is precisely when an operator most needs to be told it worked.
 */
export function ActionOutcome({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) return null;

  return (
    <Box role="status" aria-live="polite" className="flex flex-col gap-0.5">
      {lines.map((line) => (
        <Typography key={line} variant="caption" sx={{ color: 'text.secondary' }}>
          {line}
        </Typography>
      ))}
    </Box>
  );
}
