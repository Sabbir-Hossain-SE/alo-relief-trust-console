import { generateCore } from './generate';

/**
 * The archive as parallel typed arrays rather than an array of objects. Holding
 * 100,000 records as objects costs tens of megabytes and makes every scan chase
 * pointers; this layout costs about three megabytes and scans linearly.
 *
 * Only the columns the grid filters and sorts on live here. Everything else is
 * regenerated on demand from the seed, because generation is pure.
 */
export type ColumnStore = {
  readonly seed: number;
  readonly size: number;
  readonly statusId: Uint8Array;
  readonly docTypeId: Uint8Array;
  readonly programId: Uint8Array;
  readonly errorId: Uint8Array;
  readonly attempts: Uint8Array;
  readonly pageCount: Uint8Array;
  readonly missingMask: Uint8Array;
  readonly nameId: Uint32Array;
  readonly locationId: Uint32Array;
  readonly sizeBytes: Uint32Array;
  readonly confidence: Float32Array;
  readonly uploadedAt: Float64Array;
};

// Materializes the scalar columns for an archive of the given size.
export function buildColumnStore(seed: number, size: number): ColumnStore {
  if (!Number.isInteger(size) || size < 0) {
    throw new RangeError(`Archive size must be a non-negative integer, received ${size}`);
  }

  const store: ColumnStore = {
    seed,
    size,
    statusId: new Uint8Array(size),
    docTypeId: new Uint8Array(size),
    programId: new Uint8Array(size),
    errorId: new Uint8Array(size),
    attempts: new Uint8Array(size),
    pageCount: new Uint8Array(size),
    missingMask: new Uint8Array(size),
    nameId: new Uint32Array(size),
    locationId: new Uint32Array(size),
    sizeBytes: new Uint32Array(size),
    confidence: new Float32Array(size),
    uploadedAt: new Float64Array(size),
  };

  for (let index = 0; index < size; index += 1) {
    const core = generateCore(seed, index);

    store.statusId[index] = core.statusId;
    store.docTypeId[index] = core.docTypeId;
    store.programId[index] = core.programId;
    store.errorId[index] = core.errorId;
    store.attempts[index] = core.attempts;
    store.pageCount[index] = core.pageCount;
    store.missingMask[index] = core.missingMask;
    store.nameId[index] = core.nameId;
    store.locationId[index] = core.locationId;
    store.sizeBytes[index] = core.sizeBytes;
    store.confidence[index] = core.overallConfidence;
    store.uploadedAt[index] = core.uploadedAt;
  }

  return store;
}

// Total bytes held by the store's columns, for the memory claim in the README.
export function storeBytes(store: ColumnStore): number {
  return (
    store.statusId.byteLength +
    store.docTypeId.byteLength +
    store.programId.byteLength +
    store.errorId.byteLength +
    store.attempts.byteLength +
    store.pageCount.byteLength +
    store.missingMask.byteLength +
    store.nameId.byteLength +
    store.locationId.byteLength +
    store.sizeBytes.byteLength +
    store.confidence.byteLength +
    store.uploadedAt.byteLength
  );
}

// Throws if an index falls outside the archive, so callers fail loudly.
export function assertInRange(store: ColumnStore, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= store.size) {
    throw new RangeError(`Document index ${index} is outside the archive of ${store.size}`);
  }
}
