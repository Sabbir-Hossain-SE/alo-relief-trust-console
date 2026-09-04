import { describe, expect, it } from 'vitest';
import {
  BATCH_LABEL_MAX_LENGTH,
  createBatchSchema,
  fromSearchParams,
  toSearchParams,
} from './api-contract';

const parse = (search: string) => fromSearchParams(new URLSearchParams(search));

describe('fromSearchParams', () => {
  it('reads every parameter the grid writes', () => {
    expect(
      parse('status=failed&status=needs_review&type=enrollment_form&q=rahim&page=2&pageSize=25'),
    ).toEqual({
      status: ['failed', 'needs_review'],
      documentType: ['enrollment_form'],
      search: 'rahim',
      page: 2,
      pageSize: 25,
    });
  });

  it('is empty for an empty query, with no undefined keys hanging off it', () => {
    expect(parse('')).toEqual({});
  });

  /**
   * A link saved before a status was renamed carries one value the schema no
   * longer knows beside four it still does. Failing the whole object showed the
   * entire archive under a filter bar that said nothing was applied.
   */
  it('drops only the value it cannot read, and keeps the filters beside it', () => {
    expect(parse('status=completed&status=bogus&type=enrollment_form&q=rahim')).toEqual({
      status: ['completed'],
      documentType: ['enrollment_form'],
      search: 'rahim',
    });
  });

  it('drops a repeated parameter entirely when none of its values is readable', () => {
    expect(parse('status=bogus&q=rahim')).toEqual({ search: 'rahim' });
  });

  it('drops a malformed number without taking the sort with it', () => {
    expect(parse('page=-1&pageSize=abc&sort=confidence&dir=asc')).toEqual({
      sortField: 'confidence',
      sortDirection: 'asc',
    });
    expect(parse('page=1.5')).toEqual({});
  });

  it('drops a sort direction it does not know while keeping the field', () => {
    expect(parse('sort=confidence&dir=sideways')).toEqual({ sortField: 'confidence' });
  });

  it('round-trips through toSearchParams', () => {
    const query = parse(
      'status=failed&cause=password_protected&batch=batch-1&attention=1&sort=uploadedAt&dir=desc',
    );
    expect(parse(toSearchParams(query).toString())).toEqual(query);
  });
});

describe('createBatchSchema', () => {
  it('holds the label limit the upload cuts folder names to', () => {
    const label = 'x'.repeat(BATCH_LABEL_MAX_LENGTH);
    expect(createBatchSchema.safeParse({ label, fileCount: 1 }).success).toBe(true);
    expect(createBatchSchema.safeParse({ label: `${label}x`, fileCount: 1 }).success).toBe(false);
  });
});
