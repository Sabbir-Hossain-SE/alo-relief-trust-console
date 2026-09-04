import type { Correction, NormalizedRecord } from '@/domain/document';
import type { ProcessingErrorCode } from '@/domain/errors';
import type { ProcessingStatus } from '@/domain/status';

/**
 * What has changed about a document since it was generated. Uploads, retries and
 * operator corrections write here rather than into the column store, so the
 * generated archive stays a pure function of its seed and only real changes
 * occupy memory.
 */
export type DocumentPatch = {
  status?: ProcessingStatus;
  /** null clears a previously recorded failure. */
  errorCode?: ProcessingErrorCode | null;
  attempts?: number;
  fields?: Partial<NormalizedRecord>;
  corrections?: Correction[];
  processedAt?: number;
  batchId?: string;
};

/**
 * Everything that has changed since the archive was generated.
 *
 * The patches are sparse and the passes over the archive are not. Asking the
 * map about every one of a hundred thousand rows once a single document had
 * been touched cost more than the pass itself, so a byte per row says whether
 * there is anything to ask.
 */
export type Overlay = {
  readonly patches: Map<number, DocumentPatch>;
  /** 1 where the row has a patch. Grown on demand past its starting capacity. */
  touched: Uint8Array;
};

const STARTING_CAPACITY = 1024;

export function createOverlay(capacity = STARTING_CAPACITY): Overlay {
  return { patches: new Map(), touched: new Uint8Array(Math.max(1, capacity)) };
}

function markTouched(overlay: Overlay, index: number): void {
  if (index >= overlay.touched.length) {
    const grown = new Uint8Array(Math.max(index + 1, overlay.touched.length * 2));
    grown.set(overlay.touched);
    overlay.touched = grown;
  }

  overlay.touched[index] = 1;
}

/** Whether a row has a patch at all, by one typed-array read. */
export function isTouched(overlay: Overlay, index: number): boolean {
  return overlay.touched[index] === 1;
}

// Merges a patch into whatever is already recorded for a document.
export function applyPatch(overlay: Overlay, index: number, patch: DocumentPatch): void {
  const current = overlay.patches.get(index);
  markTouched(overlay, index);

  if (!current) {
    overlay.patches.set(index, { ...patch });
    return;
  }

  overlay.patches.set(index, {
    ...current,
    ...patch,
    fields: patch.fields ? { ...current.fields, ...patch.fields } : current.fields,
    corrections: patch.corrections
      ? [...(current.corrections ?? []), ...patch.corrections]
      : current.corrections,
  });
}

// Returns the patch for a document, or undefined when it is untouched.
export function readPatch(overlay: Overlay, index: number): DocumentPatch | undefined {
  return overlay.touched[index] === 1 ? overlay.patches.get(index) : undefined;
}
