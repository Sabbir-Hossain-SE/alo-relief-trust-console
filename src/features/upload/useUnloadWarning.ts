'use client';

import { useEffect } from 'react';

/**
 * Asks before the tab is closed or reloaded while `active`.
 *
 * The queue lives in the page. Closing it mid-upload abandons every file not
 * yet sent without a word, and by then the browser's own dialog is the only
 * thing that can still be said.
 */
export function useUnloadWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older engines show the dialog only for a non-empty value. The text is
      // not displayed anywhere; browsers show their own wording.
      event.returnValue = 'Uploads are still running.';
    };

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}
