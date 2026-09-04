'use client';

import { useEffect } from 'react';
import { holdUnload } from '@/lib/unload/unloadHold';

/**
 * Asks before the tab is closed or reloaded while `active`.
 *
 * The queue lives in the page. Closing it mid-upload abandons every file not
 * yet sent without a word, and by then the browser's own dialog is the only
 * thing that can still be said.
 */
export function useUnloadWarning(active: boolean): void {
  useEffect(() => (active ? holdUnload() : undefined), [active]);
}
