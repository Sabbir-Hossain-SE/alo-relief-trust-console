'use client';

import { useEffect } from 'react';

/** Marks an element whose own handlers accept a drop, so the guard leaves it alone. */
export const DROP_TARGET_ATTRIBUTE = 'data-drop-target';

function insideDropTarget(event: DragEvent): boolean {
  return (
    event.target instanceof Element && event.target.closest(`[${DROP_TARGET_ATTRIBUTE}]`) !== null
  );
}

/**
 * Stops a drop that misses its target from navigating the tab.
 *
 * Dropped on any other part of the page, a file opens in place of the
 * application — and with it goes an archive that lives in memory, along with
 * every batch of the session. A drop zone is a small target on a large screen,
 * and an operator dragging a folder across it will miss it eventually.
 *
 * Only a drop outside a marked target is refused; the zone's own handling runs
 * untouched. The cursor says so as well, so the page does not look like it
 * accepts files everywhere and then does nothing with them.
 */
export function useWindowDropGuard(): void {
  useEffect(() => {
    const refuse = (event: DragEvent) => {
      if (insideDropTarget(event)) return;

      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    };

    window.addEventListener('dragover', refuse);
    window.addEventListener('drop', refuse);

    return () => {
      window.removeEventListener('dragover', refuse);
      window.removeEventListener('drop', refuse);
    };
  }, []);
}
