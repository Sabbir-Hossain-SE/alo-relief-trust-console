import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  MAX_GRID_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  gridPageSize,
  isPageSize,
} from './pagination';

describe('the offered page sizes', () => {
  it('offers the default as one of them', () => {
    expect(PAGE_SIZE_OPTIONS).toContain(DEFAULT_PAGE_SIZE);
  });

  it('names the largest as its own maximum, rather than repeating a number', () => {
    expect(MAX_GRID_PAGE_SIZE).toBe(Math.max(...PAGE_SIZE_OPTIONS));
  });

  it('stays within what the grid can render', () => {
    // MUI X throws above a hundred rows a page under its MIT licence. Every
    // offered size has to sit under that, or the option itself is the crash.
    expect(MAX_GRID_PAGE_SIZE).toBeLessThanOrEqual(100);
  });

  it('is listed smallest first, which is the order the grid shows them in', () => {
    expect([...PAGE_SIZE_OPTIONS]).toEqual([...PAGE_SIZE_OPTIONS].sort((a, b) => a - b));
  });
});

describe('isPageSize', () => {
  it('accepts the sizes on offer', () => {
    for (const size of PAGE_SIZE_OPTIONS) expect(isPageSize(size)).toBe(true);
  });

  it('rejects everything else, including nothing at all', () => {
    for (const value of [undefined, 0, -5, 1, 37, 101, 200, 1e9, Number.NaN]) {
      expect(isPageSize(value), `${String(value)} was accepted`).toBe(false);
    }
  });
});

describe('gridPageSize', () => {
  it('keeps a size the grid can render', () => {
    expect(gridPageSize(25)).toBe(25);
    expect(gridPageSize(100)).toBe(100);
  });

  it('falls back for the value that used to take the page down', () => {
    // ?pageSize=200 passed the query schema, was served by the backend, and
    // then threw inside the grid, which unmounted the whole route.
    expect(gridPageSize(200)).toBe(DEFAULT_PAGE_SIZE);
    expect(gridPageSize(101)).toBe(DEFAULT_PAGE_SIZE);
  });

  it('falls back for a size in range that the grid was never offered', () => {
    // In range but absent from the options, which MUI warns about rather than
    // throwing on — a quieter fault, and the same cause.
    expect(gridPageSize(37)).toBe(DEFAULT_PAGE_SIZE);
  });

  it('falls back when nothing was asked for', () => {
    expect(gridPageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });
});
