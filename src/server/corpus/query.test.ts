import { describe, expect, it } from 'vitest';
import { confidenceBand } from '@/domain/confidence';
import { DOCUMENT_TYPES } from '@/domain/document';
import { PROCESSING_STATUSES, type ProcessingStatus } from '@/domain/status';
import { buildColumnStore } from './columnStore';
import { documentId } from './documentAt';
import { applyPatch, createOverlay } from './overlay';
import {
  DEFAULT_PAGE_SIZE,
  countByStatus,
  filterIndices,
  orderedIndices,
  queryDocuments,
  sortIndices,
  type SortField,
} from './query';
import { NAME_POOL } from './pools.generated';

const SEED = 20260901;
const SIZE = 5000;
const store = buildColumnStore(SEED, SIZE);
const empty = createOverlay();

function statusOf(index: number): ProcessingStatus {
  return PROCESSING_STATUSES[store.statusId[index] as number] as ProcessingStatus;
}

function firstWithStatus(status: ProcessingStatus): number {
  for (let index = 0; index < SIZE; index += 1) {
    if (statusOf(index) === status) return index;
  }
  throw new Error(`No ${status} document in the sample`);
}

describe('filtering', () => {
  it('returns everything when nothing is filtered', () => {
    expect(filterIndices(store, empty, {})).toHaveLength(SIZE);
  });

  it('returns only the requested status', () => {
    const indices = filterIndices(store, empty, { status: ['failed'] });

    expect(indices.length).toBeGreaterThan(0);
    for (const index of indices) expect(statusOf(index)).toBe('failed');
  });

  it('treats several statuses as a union', () => {
    const failed = filterIndices(store, empty, { status: ['failed'] }).length;
    const review = filterIndices(store, empty, { status: ['needs_review'] }).length;
    const both = filterIndices(store, empty, { status: ['failed', 'needs_review'] }).length;

    expect(both).toBe(failed + review);
  });

  it('ignores an empty filter array rather than matching nothing', () => {
    expect(filterIndices(store, empty, { status: [] })).toHaveLength(SIZE);
    expect(filterIndices(store, empty, { documentType: [] })).toHaveLength(SIZE);
  });

  it('filters by document type', () => {
    const type = DOCUMENT_TYPES[2] as (typeof DOCUMENT_TYPES)[number];
    const indices = filterIndices(store, empty, { documentType: [type] });

    expect(indices.length).toBeGreaterThan(0);
    for (const index of indices)
      expect(DOCUMENT_TYPES[store.docTypeId[index] as number]).toBe(type);
  });

  it('combines filters as an intersection', () => {
    const type = DOCUMENT_TYPES[0] as (typeof DOCUMENT_TYPES)[number];
    const combined = filterIndices(store, empty, { status: ['completed'], documentType: [type] });
    const byStatus = filterIndices(store, empty, { status: ['completed'] });

    expect(combined.length).toBeLessThanOrEqual(byStatus.length);
    for (const index of combined) {
      expect(statusOf(index)).toBe('completed');
      expect(DOCUMENT_TYPES[store.docTypeId[index] as number]).toBe(type);
    }
  });

  it('filters by confidence band, over extracted documents only', () => {
    const indices = filterIndices(store, empty, { confidence: ['low'] });

    expect(indices.length).toBeGreaterThan(0);
    for (const index of indices) {
      expect(confidenceBand(store.confidence[index] as number)).toBe('low');
      expect(['completed', 'needs_review']).toContain(statusOf(index));
    }
  });

  /**
   * A document the pipeline never read is stored at zero, which is the low
   * band by arithmetic. Counted, every pending and failed document joined the
   * band and the grid showed four times the figure the overview gave it.
   */
  it('never puts a document that was not extracted in a confidence band', () => {
    expect(filterIndices(store, empty, { confidence: ['low'], status: ['pending'] })).toHaveLength(
      0,
    );
    expect(
      filterIndices(store, empty, { confidence: ['low', 'medium', 'high'], status: ['failed'] }),
    ).toHaveLength(0);
  });

  it('narrows to documents an operator has to act on', () => {
    const indices = filterIndices(store, empty, { needsAttention: true });

    expect(indices.length).toBeGreaterThan(0);
    for (const index of indices) expect(['failed', 'needs_review']).toContain(statusOf(index));
  });

  it('returns nothing when filters exclude everything', () => {
    const indices = filterIndices(store, empty, {
      status: ['completed'],
      confidence: ['low'],
    });

    // Completed documents are high confidence by construction.
    expect(indices).toHaveLength(0);
  });
});

describe('search', () => {
  it('finds documents by person name', () => {
    const target = NAME_POOL[store.nameId[firstWithStatus('completed')] as number] as string;
    const indices = filterIndices(store, empty, { search: target });

    expect(indices.length).toBeGreaterThan(0);
    for (const index of indices) {
      expect(NAME_POOL[store.nameId[index] as number]).toBe(target);
    }
  });

  it('ignores case', () => {
    const target = NAME_POOL[store.nameId[0] as number] as string;
    const lower = filterIndices(store, empty, { search: target.toLowerCase() }).length;
    const upper = filterIndices(store, empty, { search: target.toUpperCase() }).length;

    expect(lower).toBe(upper);
    expect(lower).toBeGreaterThan(0);
  });

  it('matches a partial term', () => {
    const target = NAME_POOL[store.nameId[0] as number] as string;
    const partial = target.slice(0, 4);

    expect(filterIndices(store, empty, { search: partial }).length).toBeGreaterThanOrEqual(
      filterIndices(store, empty, { search: target }).length,
    );
  });

  it('finds a document by its identifier', () => {
    const indices = filterIndices(store, empty, { search: documentId(42) });

    expect(Array.from(indices)).toEqual([42]);
  });

  it('finds a document by a bare index', () => {
    expect(Array.from(filterIndices(store, empty, { search: '42' }))).toContain(42);
  });

  it('treats a blank search as no search at all', () => {
    expect(filterIndices(store, empty, { search: '' })).toHaveLength(SIZE);
    expect(filterIndices(store, empty, { search: '   ' })).toHaveLength(SIZE);
  });

  it('returns nothing for a term that matches nothing', () => {
    expect(filterIndices(store, empty, { search: 'zzzznotarealname' })).toHaveLength(0);
  });

  it('honours the other filters beside a search by id', () => {
    const index = firstWithStatus('failed');
    const id = documentId(index);

    expect(Array.from(filterIndices(store, empty, { search: id }))).toEqual([index]);
    expect(filterIndices(store, empty, { search: id, status: ['completed'] })).toHaveLength(0);
  });

  // The band filter compares numbers against the thresholds rather than naming
  // a band per row; the two have to agree exactly at the edges.
  it('places a score on a threshold in the same band the domain does', () => {
    for (const index of filterIndices(store, empty, { confidence: ['medium'] })) {
      expect(confidenceBand(store.confidence[index] as number)).toBe('medium');
    }
    for (const index of filterIndices(store, empty, { confidence: ['high'] })) {
      expect(confidenceBand(store.confidence[index] as number)).toBe('high');
    }
  });

  it('does not fall over on regex-special characters', () => {
    for (const term of ['(', '[a-z]', '.*', '\\', '?']) {
      expect(() => filterIndices(store, empty, { search: term })).not.toThrow();
    }
  });
});

describe('orderedIndices', () => {
  const same = (query: Parameters<typeof orderedIndices>[2]) => {
    const expected = sortIndices(
      store,
      filterIndices(store, empty, query),
      query.sortField ?? 'uploadedAt',
      query.sortDirection ?? 'desc',
    );
    expect(Array.from(orderedIndices(store, empty, query))).toEqual(Array.from(expected));
  };

  // The default order is walked from the kept order rather than sorted; both
  // routes have to land on the same rows in the same places.
  it('agrees with filtering then sorting, on the fast path and off it', () => {
    same({});
    same({ sortField: 'uploadedAt', sortDirection: 'desc' });
    same({ status: ['needs_review'], search: 'a' });
    same({ status: ['failed'], sortField: 'confidence', sortDirection: 'asc' });
    same({
      documentType: [DOCUMENT_TYPES[0] as (typeof DOCUMENT_TYPES)[number]],
      sortField: 'index',
    });
  });

  it('refuses a kept order that does not cover the archive', () => {
    const stale = { ...store, uploadedDesc: store.uploadedDesc.subarray(1) };
    expect(() => orderedIndices(stale, empty, {})).toThrow(RangeError);
  });
});

describe('sorting', () => {
  const all = filterIndices(store, empty, {});

  it.each(['uploadedAt', 'confidence', 'personName', 'status', 'documentType', 'index'] as const)(
    'orders ascending by %s',
    (field: SortField) => {
      const ordered = sortIndices(store, all, field, 'asc');
      const read = (index: number) =>
        field === 'index'
          ? index
          : field === 'personName'
            ? (store.nameId[index] as number)
            : field === 'status'
              ? (store.statusId[index] as number)
              : field === 'documentType'
                ? (store.docTypeId[index] as number)
                : field === 'confidence'
                  ? (store.confidence[index] as number)
                  : (store.uploadedAt[index] as number);

      for (let i = 1; i < ordered.length; i += 1) {
        expect(read(ordered[i] as number)).toBeGreaterThanOrEqual(read(ordered[i - 1] as number));
      }
    },
  );

  it('reverses cleanly', () => {
    const asc = sortIndices(store, all, 'uploadedAt', 'asc');
    const desc = sortIndices(store, all, 'uploadedAt', 'desc');

    expect(store.uploadedAt[desc[0] as number]).toBe(
      store.uploadedAt[asc[asc.length - 1] as number],
    );
  });

  it('breaks ties by index so paging never skips or repeats a row', () => {
    // Status has only five distinct values across thousands of rows, so ties are
    // the norm rather than the exception here.
    const ordered = sortIndices(store, all, 'status', 'asc');

    for (let i = 1; i < ordered.length; i += 1) {
      const previous = ordered[i - 1] as number;
      const current = ordered[i] as number;

      if (store.statusId[previous] === store.statusId[current]) {
        expect(current).toBeGreaterThan(previous);
      }
    }
  });

  it('is stable across repeated calls', () => {
    const a = sortIndices(store, all, 'confidence', 'desc');
    const b = sortIndices(store, all, 'confidence', 'desc');

    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('does not mutate the array it was given', () => {
    const subset = filterIndices(store, empty, { status: ['failed'] });
    const before = Array.from(subset);
    sortIndices(store, subset, 'confidence', 'asc');

    expect(Array.from(subset)).toEqual(before);
  });

  it('handles an empty result', () => {
    expect(sortIndices(store, new Uint32Array(0), 'uploadedAt', 'asc')).toHaveLength(0);
  });
});

describe('paging', () => {
  it('defaults to the first page', () => {
    const result = queryDocuments(store, empty);

    expect(result.page).toBe(0);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(result.rows).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(result.total).toBe(SIZE);
  });

  it('reports a page count that covers the remainder', () => {
    // 120 divides 5,000 unevenly and stays under the cap, so this exercises the
    // remainder rather than the clamp.
    const result = queryDocuments(store, empty, { pageSize: 120 });

    expect(result.pageSize).toBe(120);
    expect(result.pageCount).toBe(Math.ceil(SIZE / 120));
  });

  it('returns a short final page rather than padding it', () => {
    const pageSize = 120;
    const last = Math.ceil(SIZE / pageSize) - 1;
    const result = queryDocuments(store, empty, { pageSize, page: last });

    expect(result.rows).toHaveLength(SIZE - last * pageSize);
    expect(result.rows.length).toBeLessThan(pageSize);
  });

  it('returns nothing past the end instead of throwing', () => {
    const result = queryDocuments(store, empty, { page: 9999 });

    expect(result.rows).toEqual([]);
    expect(result.total).toBe(SIZE);
  });

  it('never repeats a row across consecutive pages', () => {
    const pageSize = 25;
    const seen = new Set<string>();

    for (let page = 0; page < 6; page += 1) {
      for (const row of queryDocuments(store, empty, { pageSize, page }).rows) {
        expect(seen.has(row.id)).toBe(false);
        seen.add(row.id);
      }
    }

    expect(seen.size).toBe(pageSize * 6);
  });

  it('rejects a nonsensical page or page size', () => {
    expect(() => queryDocuments(store, empty, { page: -1 })).toThrow(RangeError);
    expect(() => queryDocuments(store, empty, { page: 1.5 })).toThrow(RangeError);
    expect(() => queryDocuments(store, empty, { pageSize: 0 })).toThrow(RangeError);
    expect(() => queryDocuments(store, empty, { pageSize: -10 })).toThrow(RangeError);
  });

  it('caps an absurd page size instead of building an enormous page', () => {
    expect(queryDocuments(store, empty, { pageSize: 100_000 }).pageSize).toBe(200);
  });

  it('reports an empty archive honestly', () => {
    const result = queryDocuments(buildColumnStore(SEED, 0), empty);

    expect(result).toMatchObject({ rows: [], total: 0, pageCount: 0 });
  });

  it('reports zero pages when filters match nothing', () => {
    const result = queryDocuments(store, empty, { search: 'zzzznothing' });

    expect(result).toMatchObject({ rows: [], total: 0, pageCount: 0 });
  });
});

describe('overlay awareness', () => {
  it('follows a document that changed status', () => {
    const index = firstWithStatus('failed');
    const overlay = createOverlay();
    applyPatch(overlay, index, { status: 'completed' });

    const failed = filterIndices(store, overlay, { status: ['failed'] });
    const completed = filterIndices(store, overlay, { status: ['completed'] });

    expect(Array.from(failed)).not.toContain(index);
    expect(Array.from(completed)).toContain(index);
  });

  it('leaves the base archive untouched', () => {
    const index = firstWithStatus('failed');
    const overlay = createOverlay();
    applyPatch(overlay, index, { status: 'completed' });

    expect(Array.from(filterIndices(store, empty, { status: ['failed'] }))).toContain(index);
  });

  it('keeps totals consistent after a patch', () => {
    const overlay = createOverlay();
    applyPatch(overlay, firstWithStatus('failed'), { status: 'completed' });

    expect(filterIndices(store, overlay, {})).toHaveLength(SIZE);
  });
});

describe('countByStatus', () => {
  it('accounts for every document exactly once', () => {
    const counts = countByStatus(store, empty);
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

    expect(total).toBe(SIZE);
  });

  it('agrees with filtering', () => {
    const counts = countByStatus(store, empty);

    for (const status of PROCESSING_STATUSES) {
      expect(counts[status]).toBe(filterIndices(store, empty, { status: [status] }).length);
    }
  });

  it('reflects overlay changes', () => {
    const index = firstWithStatus('failed');
    const before = countByStatus(store, empty);
    const overlay = createOverlay();
    applyPatch(overlay, index, { status: 'completed' });
    const after = countByStatus(store, overlay);

    expect(after.failed).toBe(before.failed - 1);
    expect(after.completed).toBe(before.completed + 1);
  });

  it('returns all zeroes for an empty archive', () => {
    const counts = countByStatus(buildColumnStore(SEED, 0), empty);

    expect(Object.values(counts).every((value) => value === 0)).toBe(true);
  });
});

describe('materialization', () => {
  it('builds records only for the requested page', () => {
    const result = queryDocuments(store, empty, { pageSize: 10 });

    expect(result.rows).toHaveLength(10);
    expect(result.total).toBe(SIZE);
  });

  it('returns rows matching the filter it was given', () => {
    const result = queryDocuments(store, empty, { status: ['failed'], pageSize: 20 });

    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row.status).toBe('failed');
      expect(row.errorCode).toBeDefined();
    }
  });

  it('orders the page the way it was asked to', () => {
    const result = queryDocuments(store, empty, {
      sortField: 'uploadedAt',
      sortDirection: 'desc',
      pageSize: 30,
    });

    for (let i = 1; i < result.rows.length; i += 1) {
      const previous = result.rows[i - 1]?.uploadedAt ?? 0;
      expect(result.rows[i]?.uploadedAt).toBeLessThanOrEqual(previous);
    }
  });
});
