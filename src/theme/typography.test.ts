import { describe, expect, it } from 'vitest';
import { createAppTheme } from './theme';
import { fontStacks } from './tokens';

const theme = createAppTheme();

const HEADINGS = ['h1', 'h2', 'h3'] as const;

/** The documented scale: 12 / 14 / 16 / 20 / 28 / 40. */
const SCALE_REM = [0.75, 0.875, 1, 1.25, 1.75, 2.5];

describe('typography', () => {
  /**
   * One typeface for the interface. The display face is still loaded and is
   * used in exactly one place — the wordmark in `BrandMark`, which is a logo
   * rather than a heading.
   */
  it('sets every heading in the body face', () => {
    for (const level of HEADINGS) {
      expect(theme.typography[level].fontFamily, level).toBe(fontStacks.body);
    }
  });

  it('leaves the display face out of the interface entirely', () => {
    const used = Object.values(theme.typography)
      .map((value) => (typeof value === 'object' && value !== null ? value : {}))
      .map((value) => (value as { fontFamily?: string }).fontFamily)
      .filter((family): family is string => family !== undefined);

    expect(used).not.toContain(fontStacks.display);
  });

  /**
   * Inter needs negative tracking to hold together at display sizes. Left at
   * its default spacing a 40px heading reads as loose beside 14px body text,
   * which is how a single-family scale ends up looking accidental.
   */
  it('tightens the headings, more so the larger they are', () => {
    const tracking = HEADINGS.map((level) =>
      Number(String(theme.typography[level].letterSpacing).replace('em', '')),
    );

    expect(tracking.every((value) => value < 0)).toBe(true);
    expect(tracking).toEqual([...tracking].sort((a, b) => a - b));
  });

  it('keeps every heading on the documented scale', () => {
    for (const level of HEADINGS) {
      const size = Number(String(theme.typography[level].fontSize).replace('rem', ''));

      expect(SCALE_REM, level).toContain(size);
    }
  });

  it('keeps the sizes distinct, so the hierarchy is readable', () => {
    const sizes = HEADINGS.map((level) =>
      Number(String(theme.typography[level].fontSize).replace('rem', '')),
    );

    expect(new Set(sizes).size).toBe(sizes.length);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });
});
