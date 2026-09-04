'use client';

import useMediaQuery from '@mui/material/useMediaQuery';

/** Phones and tablets: a coarse pointer and nothing to hover with. */
const TOUCH_ONLY = '(hover: none) and (pointer: coarse)';

function hasDirectoryPicker(): boolean {
  return typeof HTMLInputElement !== 'undefined' && 'webkitdirectory' in HTMLInputElement.prototype;
}

export type UploadAffordances = {
  /** Files can be dragged in from the operating system. */
  canDrop: boolean;
  /** A whole folder can be chosen at once. */
  canPickFolder: boolean;
};

/**
 * What the upload screen may honestly offer on this device.
 *
 * A phone has no window to drag a file out of, and its picker returns files
 * however the input is marked: `webkitdirectory` is present in the engine and
 * ignored by the picker, so a "Choose a folder" button opened the plain file
 * picker and left the operator wondering what they had done wrong. Read from
 * the pointer rather than the user agent, because a touch-only device is the
 * thing being detected, whatever its browser calls itself.
 */
export function useUploadAffordances(): UploadAffordances {
  // Not rendered on the server: this screen sits behind the mock backend's gate.
  const touchOnly = useMediaQuery(TOUCH_ONLY, { noSsr: true });

  return { canDrop: !touchOnly, canPickFolder: !touchOnly && hasDirectoryPicker() };
}
