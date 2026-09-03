'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};

  const query = window.matchMedia(QUERY);
  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

// The server cannot know the preference, so it renders the motion-enabled theme.
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Reports whether the operator has asked for reduced motion.
 *
 * CSS alone cannot carry this: MUI schedules its enter and exit callbacks with
 * `setTimeout` from the theme's durations, which no stylesheet can reach. The
 * preference has to be readable from JavaScript to shorten those.
 *
 * Subscribed rather than read once, so changing the system setting takes effect
 * without a reload.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
