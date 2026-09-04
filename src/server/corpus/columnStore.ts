import { yieldToMain } from '@/lib/file-ingest/yielding';
import { generateCore } from './generate';
import { mergeUploadedOrder, uploadedOrder } from './sort';

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
  /** Documents currently in the archive. Grows as uploads arrive. */
  size: number;
  /** Rows allocated up front, so an upload never reallocates the columns. */
  readonly capacity: number;
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
  /**
   * Every row, newest upload first — the order the grid opens in.
   *
   * Kept beside the columns because the default view used to sort the whole
   * archive on every request to show fifty rows of it. Grows with `size`:
   * rows an upload appends are folded in as they arrive.
   */
  uploadedDesc: Uint32Array;
};

// Fills one row from the generator.
function writeRow(store: ColumnStore, index: number): void {
  const core = generateCore(store.seed, index);

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

/**
 * Materializes the scalar columns for an archive of the given size.
 *
 * `headroom` reserves rows for documents uploaded later. Allocating them up
 * front costs about a third of a byte per row and means an upload never has to
 * reallocate and copy twelve typed arrays mid-session.
 */
function allocate(seed: number, size: number, headroom: number): ColumnStore {
  if (!Number.isInteger(size) || size < 0) {
    throw new RangeError(`Archive size must be a non-negative integer, received ${size}`);
  }

  if (!Number.isInteger(headroom) || headroom < 0) {
    throw new RangeError(`Headroom must be a non-negative integer, received ${headroom}`);
  }

  const capacity = size + headroom;

  return {
    seed,
    size,
    capacity,
    statusId: new Uint8Array(capacity),
    docTypeId: new Uint8Array(capacity),
    programId: new Uint8Array(capacity),
    errorId: new Uint8Array(capacity),
    attempts: new Uint8Array(capacity),
    pageCount: new Uint8Array(capacity),
    missingMask: new Uint8Array(capacity),
    nameId: new Uint32Array(capacity),
    locationId: new Uint32Array(capacity),
    sizeBytes: new Uint32Array(capacity),
    confidence: new Float32Array(capacity),
    uploadedAt: new Float64Array(capacity),
    uploadedDesc: new Uint32Array(0),
  };
}

export function buildColumnStore(seed: number, size: number, headroom = 0): ColumnStore {
  const store = allocate(seed, size, headroom);

  for (let index = 0; index < size; index += 1) writeRow(store, index);
  store.uploadedDesc = uploadedOrder(store);

  return store;
}

/** Rows generated between yields: about a dozen milliseconds each. */
const BUILD_SLICE = 10_000;

/**
 * The same archive, built with a breath between slices.
 *
 * A hundred thousand rows in one pass is an eighth of a second the page
 * cannot paint through. Built this way behind the loading gate, it overlaps
 * the service worker's own start and never lands after the page is up.
 */
export async function buildColumnStoreInSlices(
  seed: number,
  size: number,
  headroom = 0,
): Promise<ColumnStore> {
  const store = allocate(seed, size, headroom);

  for (let start = 0; start < size; start += BUILD_SLICE) {
    const end = Math.min(size, start + BUILD_SLICE);
    for (let index = start; index < end; index += 1) writeRow(store, index);
    await yieldToMain();
  }

  store.uploadedDesc = uploadedOrder(store);

  return store;
}

/**
 * Adds documents to the archive and returns their indices.
 *
 * New rows are generated the same way as the rest of the archive, so an
 * uploaded document is indistinguishable from an archived one once processed.
 */
export function appendDocuments(store: ColumnStore, count: number): Uint32Array {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`Document count must be a non-negative integer, received ${count}`);
  }

  if (store.size + count > store.capacity) {
    throw new RangeError(
      `Cannot add ${count} documents: capacity is ${store.capacity} and ${store.size} are in use`,
    );
  }

  const added = new Uint32Array(count);

  for (let offset = 0; offset < count; offset += 1) {
    const index = store.size + offset;
    writeRow(store, index);
    added[offset] = index;
  }

  store.size += count;
  store.uploadedDesc = mergeUploadedOrder(store, store.uploadedDesc, added);

  return added;
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
    store.uploadedAt.byteLength +
    store.uploadedDesc.byteLength
  );
}

// Throws if an index falls outside the archive, so callers fail loudly.
export function assertInRange(store: ColumnStore, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= store.size) {
    throw new RangeError(`Document index ${index} is outside the archive of ${store.size}`);
  }
}
