import { describe, expect, it } from 'vitest';
import { activeFilters } from './activeFilters';

describe('activeFilters', () => {
  it('finds nothing on an unfiltered view', () => {
    expect(activeFilters({})).toEqual([]);
    expect(activeFilters({ page: 3, sortField: 'confidence' })).toEqual([]);
  });

  it('leaves the search term out, because its own field already shows it', () => {
    // A chip repeating the term would be a second control for the same thing
    // rather than a summary of anything the sheet is hiding.
    expect(activeFilters({ search: 'nasrin' })).toEqual([]);
  });

  it('names each narrowing the way the filter that set it does', () => {
    const filters = activeFilters({
      documentType: ['id_scan'],
      status: ['needs_review'],
      confidence: ['low'],
    });

    expect(filters.map((filter) => filter.label)).toEqual([
      'ID scan',
      'Needs review',
      'Low confidence',
    ]);
  });

  it('lifts one value without disturbing the others beside it', () => {
    const query = { status: ['failed', 'needs_review'] } as const;
    const failed = activeFilters({ status: [...query.status] }).find(
      (filter) => filter.id === 'status:failed',
    );

    expect(failed?.patch).toEqual({ status: ['needs_review'] });
  });

  it('clears a filter outright when its last value goes', () => {
    const [only] = activeFilters({ confidence: ['low'] });

    // `{ confidence: [] }` would leave an empty array in the URL, which reads
    // as a filter that matches nothing rather than as no filter at all.
    expect(only?.patch).toEqual({ confidence: undefined });
  });

  it('covers the narrowings that arrive from elsewhere in the app', () => {
    // A cause arrives from the overview's failure breakdown. Without a chip it
    // was a narrowing with no name on screen and no way off but the navigation.
    const filters = activeFilters({
      errorCode: ['unreadable_scan'],
      batchId: 'batch-7',
      needsAttention: true,
    });

    expect(filters.map((filter) => filter.label)).toEqual([
      'Scan too poor to read',
      'Batch batch-7',
      'Needs attention',
    ]);
    expect(filters.map((filter) => filter.patch)).toEqual([
      { errorCode: undefined },
      { batchId: undefined },
      { needsAttention: undefined },
    ]);
  });

  it('gives every chip a key that survives its neighbours being removed', () => {
    const filters = activeFilters({
      status: ['failed', 'pending'],
      confidence: ['low', 'high'],
    });

    expect(new Set(filters.map((filter) => filter.id)).size).toBe(filters.length);
  });
});
