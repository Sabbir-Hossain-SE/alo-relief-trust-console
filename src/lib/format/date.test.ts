import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatDuration } from './date';

/**
 * `Intl` resolves against the machine's zone, so an instant that is one date in
 * London is another in Dhaka. The formatters are asserted through the same
 * resolved zone the app runs in rather than against a hard-coded string, which
 * would pass only on the machine it was written on.
 */
function zoned(epochMs: number, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', options).format(new Date(epochMs));
}

const EPOCH = Date.UTC(2026, 8, 4, 9, 30);

describe('formatDate', () => {
  it('names the month rather than numbering it', () => {
    expect(formatDate(EPOCH)).toBe(
      zoned(EPOCH, { day: 'numeric', month: 'short', year: 'numeric' }),
    );
    expect(formatDate(EPOCH)).toMatch(/[A-Za-z]{3}/);
  });

  it('carries no time of day', () => {
    expect(formatDate(EPOCH)).not.toMatch(/\d{2}:\d{2}/);
  });
});

describe('formatDateTime', () => {
  it('adds a zero-padded time to the date', () => {
    expect(formatDateTime(EPOCH)).toBe(
      zoned(EPOCH, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
    expect(formatDateTime(EPOCH)).toMatch(/\d{2}:\d{2}/);
  });
});

describe('formatDuration', () => {
  it('does not pretend to sub-second precision', () => {
    expect(formatDuration(0)).toBe('under a second');
    expect(formatDuration(999)).toBe('under a second');
  });

  it('reports seconds up to a minute', () => {
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(59_000)).toBe('59s');
  });

  it('reports minutes up to an hour', () => {
    expect(formatDuration(90_000)).toBe('2 min');
    expect(formatDuration(59 * 60_000)).toBe('59 min');
  });

  it('reports hours and remaining minutes beyond an hour', () => {
    expect(formatDuration(60 * 60_000)).toBe('1h 0m');
    expect(formatDuration(95 * 60_000)).toBe('1h 35m');
    expect(formatDuration(25 * 60 * 60_000)).toBe('25h 0m');
  });

  // Rounding seconds to 60 must not print "60s", and rounding minutes to 60
  // must not print "60 min" — both are the boundary the coarser unit exists for.
  it('steps up to the next unit at a rounding boundary', () => {
    expect(formatDuration(59_500)).toBe('1 min');
    expect(formatDuration(59.5 * 60_000)).toBe('1h 0m');
  });
});
