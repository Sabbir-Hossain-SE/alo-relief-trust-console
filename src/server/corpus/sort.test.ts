import { describe, expect, it } from 'vitest';
import type { SortDirection, SortField } from '@/domain/sort';
import { appendDocuments, buildColumnStore, type ColumnStore } from './columnStore';
import { applyPatch, createOverlay } from './overlay';
import { filterIndices } from './query';
import { mergeUploadedOrder, sortIndices, uploadedOrder } from './sort';

const SEED = 20260901;
const SIZE = 5000;
const FIELDS = [
  'uploadedAt',
  'confidence',
  'personName',
  'status',
  'documentType',
  'index',
] as const;

const store = buildColumnStore(SEED, SIZE);
const empty = createOverlay();

/** The comparator sort this replaced, kept here as the definition of "the same order". */
function referenceOrder(
  target: ColumnStore,
  indices: Uint32Array,
  field: SortField,
  direction: SortDirection,
): number[] {
  const value = (index: number): number => {
    switch (field) {
      case 'uploadedAt':
        return target.uploadedAt[index] as number;
      case 'confidence':
        return target.confidence[index] as number;
      case 'personName':
        return target.nameId[index] as number;
      case 'status':
        return target.statusId[index] as number;
      case 'documentType':
        return target.docTypeId[index] as number;
      case 'index':
        return index;
    }
  };
  const sign = direction === 'desc' ? -1 : 1;

  return Array.from(indices).sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left < right) return -sign;
    if (left > right) return sign;
    return a - b;
  });
}

function every(size: number): Uint32Array {
  return Uint32Array.from({ length: size }, (_, index) => index);
}

describe('sortIndices', () => {
  const all = every(SIZE);
  const subset = filterIndices(store, empty, { status: ['failed', 'needs_review'] });

  it.each(FIELDS.flatMap((field) => [[field, 'asc'] as const, [field, 'desc'] as const]))(
    'orders by %s %s exactly as the comparator did',
    (field, direction) => {
      expect(Array.from(sortIndices(store, all, field, direction))).toEqual(
        referenceOrder(store, all, field, direction),
      );
      expect(Array.from(sortIndices(store, subset, field, direction))).toEqual(
        referenceOrder(store, subset, field, direction),
      );
    },
  );

  // The packed key divides upload times down to seconds and reads confidence
  // as float bits; both only order correctly if these hold for every row.
  it('relies on whole-second uploads and non-negative confidence, which the generator gives', () => {
    for (let index = 0; index < SIZE; index += 1) {
      expect((store.uploadedAt[index] as number) % 1000).toBe(0);
      expect(store.confidence[index] as number).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(store.confidence[index] as number)).toBe(false);
    }
  });

  it('refuses an archive larger than a key can address', () => {
    const oversized = { ...store, size: 2 ** 21 + 1 } as ColumnStore;
    expect(() => sortIndices(oversized, all, 'status', 'asc')).toThrow(RangeError);
  });

  /**
   * Sorting has never read the overlay: a corrected or retried document keeps
   * its generated place. Pinned here so a change to that is a decision made
   * in the open rather than a side effect of a faster sort.
   */
  it('keeps the generated order for a patched document', () => {
    const patched = createOverlay();
    for (const index of [3, 17, 4242]) applyPatch(patched, index, { status: 'completed' });

    for (const field of ['status', 'confidence'] as const) {
      expect(Array.from(sortIndices(store, all, field, 'asc'))).toEqual(
        referenceOrder(store, all, field, 'asc'),
      );
    }
  });
});

describe('the kept upload order', () => {
  it('is the archive newest first, ties by index', () => {
    expect(Array.from(uploadedOrder(store))).toEqual(
      referenceOrder(store, every(SIZE), 'uploadedAt', 'desc'),
    );
    expect(Array.from(store.uploadedDesc)).toEqual(Array.from(uploadedOrder(store)));
  });

  /**
   * An upload appends rows whose dates are as scattered as the rest of the
   * archive's, so the order has to take them into its middle, not its head —
   * and a merge that merely appended would leave them off the first page
   * they belong on.
   */
  it('folds appended rows into their place', () => {
    const grown = buildColumnStore(SEED, SIZE, 1000);
    const added = appendDocuments(grown, 500);

    const order = grown.uploadedDesc;
    expect(order).toHaveLength(grown.size);
    expect(Array.from(order)).toEqual(
      referenceOrder(grown, every(grown.size), 'uploadedAt', 'desc'),
    );
    expect(new Set(order).size).toBe(grown.size);

    const positions = Array.from(added, (index) => order.indexOf(index));
    expect(Math.min(...positions)).toBeGreaterThan(0);
    expect(Math.max(...positions)).toBeLessThan(grown.size - 1);
  });

  it('merges an empty block without touching the order', () => {
    const merged = mergeUploadedOrder(store, store.uploadedDesc, new Uint32Array(0));
    expect(Array.from(merged)).toEqual(Array.from(store.uploadedDesc));
  });
});
