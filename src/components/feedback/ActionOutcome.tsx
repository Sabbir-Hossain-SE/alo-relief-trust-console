'use client';

import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * Says what the last action did.
 *
 * Kept outside the thing it acted on, because a successful action usually
 * changes that thing's state and the notice would unmount along with it — which
 * is precisely when an operator most needs to be told it worked.
 *
 * It also takes focus when it appears. The buttons here tend to remove
 * themselves on success — a save disables once the form is clean, a retry
 * button vanishes once nothing is left to retry — and a focused element that
 * disappears drops focus to the top of the document. Catching it here keeps a
 * keyboard user where they were working.
 */
export function ActionOutcome({ lines }: { lines: readonly string[] }) {
  const region = useRef<HTMLDivElement>(null);
  const had = useRef(false);

  const has = lines.length > 0;

  useEffect(() => {
    if (has && !had.current) region.current?.focus();
    had.current = has;
  }, [has]);

  if (!has) return null;

  return (
    <Box
      ref={region}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className="flex flex-col gap-0.5"
      sx={{ outline: 'none' }}
    >
      {lines.map((line) => (
        <Typography key={line} variant="caption" sx={{ color: 'text.secondary' }}>
          {line}
        </Typography>
      ))}
    </Box>
  );
}
