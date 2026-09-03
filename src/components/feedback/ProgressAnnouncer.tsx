'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';

/** How many times a run may interrupt a screen reader before it finishes. */
const STEPS = 10;

type ProgressAnnouncerProps = {
  completion: number;
  message: string;
  settled?: boolean;
};

/**
 * Announces progress at intervals rather than on every tick.
 *
 * A live region that updates on every file makes a screen reader unusable on a
 * long run: the reader restarts mid-sentence and the operator never hears a
 * whole one. The message is held until progress crosses the next tenth, and the
 * finish is always announced because it is the update worth interrupting for.
 *
 * The held value is state adjusted during render, not an effect, so the
 * announcement lands on the same commit as the figures it describes.
 */
export function ProgressAnnouncer({ completion, message, settled }: ProgressAnnouncerProps) {
  const [announced, setAnnounced] = useState({ step: -1, message: '' });

  const step = settled === true ? STEPS + 1 : Math.floor(completion * STEPS);
  if (step !== announced.step) setAnnounced({ step, message });

  return (
    <Box className="sr-only" role="status" aria-live="polite" aria-atomic>
      {announced.message}
    </Box>
  );
}
