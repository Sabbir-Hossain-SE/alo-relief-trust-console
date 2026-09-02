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

export type Overlay = Map<number, DocumentPatch>;

export function createOverlay(): Overlay {
  return new Map();
}

// Merges a patch into whatever is already recorded for a document.
export function applyPatch(overlay: Overlay, index: number, patch: DocumentPatch): void {
  const current = overlay.get(index);

  if (!current) {
    overlay.set(index, { ...patch });
    return;
  }

  overlay.set(index, {
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
  return overlay.get(index);
}
