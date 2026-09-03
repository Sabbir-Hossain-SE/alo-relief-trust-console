import { describe, expect, it } from 'vitest';
import { formatBytes, formatCount, formatPercent } from './number';

describe('formatCount', () => {
  it('separates thousands', () => {
    expect(formatCount(100_000)).toBe('100,000');
  });

  it('leaves small numbers alone', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
  });
});

describe('formatPercent', () => {
  it('renders a share as a whole percentage', () => {
    expect(formatPercent(1, 4)).toBe('25%');
    expect(formatPercent(4, 4)).toBe('100%');
  });

  // A batch with nothing in it is the first thing the monitor renders, so this
  // path runs before any real division ever does.
  it('reports 0% rather than NaN for an empty total', () => {
    expect(formatPercent(0, 0)).toBe('0%');
  });

  it('rounds to the nearest whole percent', () => {
    expect(formatPercent(1, 3)).toBe('33%');
    expect(formatPercent(2, 3)).toBe('67%');
  });
});

describe('formatBytes', () => {
  it('keeps bytes exact below a kilobyte', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('steps up a unit at each threshold', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 ** 2)).toBe('1.0 MB');
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB');
  });

  it('stops at gigabytes rather than inventing a larger unit', () => {
    expect(formatBytes(1024 ** 4)).toBe('1024.0 GB');
  });

  it('reports one decimal place', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(52_428_800)).toBe('50.0 MB');
  });
});
