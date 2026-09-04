import type { SortDirection, SortField } from '@/domain/sort';
import type { ColumnStore } from './columnStore';

/** Rows this scheme can address; the archive's capacity has to stay under it. */
const INDEX_SPAN = 2 ** 21;

/** Above every key below, so a descending order is a subtraction. */
const MAX_KEY = 2 ** 31;

/**
 * A non-negative integer key per row, read straight from a column.
 *
 * Upload times are whole seconds, so divided down they fit under `MAX_KEY`
 * until 2038. Confidence is read as the bit pattern of its float32: for
 * non-negative floats that pattern orders the same way the value does, and it
 * costs nothing — the view shares the column's buffer.
 */
function keyOf(store: ColumnStore, field: Exclude<SortField, 'index'>): (index: number) => number {
  switch (field) {
    case 'uploadedAt': {
      const column = store.uploadedAt;
      return (index) => (column[index] as number) / 1000;
    }
    case 'confidence': {
      const bits = new Uint32Array(
        store.confidence.buffer,
        store.confidence.byteOffset,
        store.confidence.length,
      );
      return (index) => bits[index] as number;
    }
    case 'personName': {
      const column = store.nameId;
      return (index) => column[index] as number;
    }
    case 'status': {
      const column = store.statusId;
      return (index) => column[index] as number;
    }
    case 'documentType': {
      const column = store.docTypeId;
      return (index) => column[index] as number;
    }
  }
}

/**
 * Orders matching rows without a comparator.
 *
 * Each row's key and index are packed into one float64 — `key × 2²¹ + index`,
 * at most 2⁵², so every value is an exact integer — and the packed array is
 * sorted by the engine's own numeric sort, which is what a comparator closure
 * over a hundred thousand rows kept off the fast path. The index is the final
 * tie-break in both directions, so equal keys never reorder between requests
 * and paging never skips or repeats a row.
 */
export function sortIndices(
  store: ColumnStore,
  indices: Uint32Array,
  field: SortField,
  direction: SortDirection,
): Uint32Array {
  if (store.size > INDEX_SPAN) {
    throw new RangeError(`An archive of ${store.size} is more than a sort key can address`);
  }

  const descending = direction === 'desc';

  if (field === 'index') {
    // Indices are unique, so this is a copy in order and, reversed, in the other.
    const ordered = Uint32Array.from(indices).sort();
    return descending ? ordered.reverse() : ordered;
  }

  const key = keyOf(store, field);
  const packed = new Float64Array(indices.length);

  for (let position = 0; position < indices.length; position += 1) {
    const index = indices[position] as number;
    const value = key(index);
    packed[position] = (descending ? MAX_KEY - value : value) * INDEX_SPAN + index;
  }

  packed.sort();

  const ordered = new Uint32Array(indices.length);
  for (let position = 0; position < indices.length; position += 1) {
    ordered[position] = (packed[position] as number) % INDEX_SPAN;
  }

  return ordered;
}

/** Every row of the archive, newest upload first. */
export function uploadedOrder(store: ColumnStore): Uint32Array {
  const all = new Uint32Array(store.size);
  for (let index = 0; index < store.size; index += 1) all[index] = index;

  return sortIndices(store, all, 'uploadedAt', 'desc');
}

/**
 * Folds newly appended rows into an existing newest-first order.
 *
 * The block is sorted on its own, then merged in one pass. On an equal upload
 * time the existing row goes first: appended rows always carry the larger
 * indices, so that keeps the tie-break the sort itself would have chosen.
 */
export function mergeUploadedOrder(
  store: ColumnStore,
  existing: Uint32Array,
  added: Uint32Array,
): Uint32Array {
  const block = sortIndices(store, added, 'uploadedAt', 'desc');
  const merged = new Uint32Array(existing.length + block.length);
  const uploadedAt = store.uploadedAt;

  let left = 0;
  let right = 0;
  let out = 0;

  while (left < existing.length && right < block.length) {
    const fromExisting = existing[left] as number;
    const fromBlock = block[right] as number;

    if ((uploadedAt[fromExisting] as number) >= (uploadedAt[fromBlock] as number)) {
      merged[out] = fromExisting;
      left += 1;
    } else {
      merged[out] = fromBlock;
      right += 1;
    }
    out += 1;
  }

  merged.set(existing.subarray(left), out);
  merged.set(block.subarray(right), out + (existing.length - left));

  return merged;
}
