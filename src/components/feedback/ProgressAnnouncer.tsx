'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';

/** How many times a run may interrupt a screen reader before it finishes. */
const STEPS = 10;

/** The step for work with a known total: one announcement per tenth. */
export function decile(completion: number): number {
  return Math.floor(completion * STEPS);
}

/** The step for work with no known total: one announcement per `every` items. */
export function everyNth(count: number, every: number): number {
  return Math.floor(count / every);
}

type ProgressAnnouncerProps = {
  /** Announce only when this changes. */
  step: number;
  message: string;
  /** Announce regardless, because finishing is always worth interrupting for. */
  final?: boolean;
};

/**
 * Announces progress at intervals rather than on every tick.
 *
 * A live region that updates on every file makes a screen reader unusable on a
 * long run: the reader restarts mid-sentence and the operator never hears a
 * whole one. The message is held until the step changes.
 *
 * The held value is state adjusted during render, not an effect, so the
 * announcement lands on the same commit as the figures it describes.
 */
export function ProgressAnnouncer({ step, message, final }: ProgressAnnouncerProps) {
  const [announced, setAnnounced] = useState({ step: Number.NaN, message: '' });

  const current = final === true ? Number.POSITIVE_INFINITY : step;
  if (current !== announced.step) setAnnounced({ step: current, message });

  return (
    <Box className="sr-only" role="status" aria-live="polite" aria-atomic>
      {announced.message}
    </Box>
  );
}
