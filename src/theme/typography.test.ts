import { describe, expect, it } from 'vitest';
import { createAppTheme } from './theme';
import { fontStacks } from './tokens';

const theme = createAppTheme();

const HEADINGS = ['h1', 'h2', 'h3'] as const;
const FIGURES = ['figureLarge', 'figureMedium'] as const;

/** The documented scale: 12 / 14 / 16 / 20 / 28 / 40. */
const SCALE_REM = [0.75, 0.875, 1, 1.25, 1.75, 2.5];

describe('typography', () => {
  /**
   * One typeface for the interface. The display face is still loaded and is
   * used in exactly one place — the wordmark in `BrandMark`, which is a logo
   * rather than a heading.
   */
  it('sets every heading and figure in the body face', () => {
    for (const level of [...HEADINGS, ...FIGURES]) {
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

  it('keeps every heading and figure on the documented scale', () => {
    for (const level of [...HEADINGS, ...FIGURES]) {
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

describe('figures are not headings', () => {
  const sizeOf = (level: (typeof HEADINGS)[number] | (typeof FIGURES)[number]) =>
    Number(String(theme.typography[level].fontSize).replace('rem', ''));

  /**
   * The counts were set in h1 and h2, which tied the size of the archive total
   * to the size of a page title. They are different jobs: the chrome should be
   * quiet on a console worked for hours, and the figure is the thing being
   * read. Separating them is what let the headings come down without taking
   * the data with them.
   */
  it('leaves the figures larger than the headings that used to carry them', () => {
    expect(sizeOf('figureLarge')).toBeGreaterThan(sizeOf('h1'));
    expect(sizeOf('figureMedium')).toBeGreaterThanOrEqual(sizeOf('h1'));
  });

  it('keeps the interface chrome compact', () => {
    // A page title above this stops being chrome and starts being a banner.
    expect(sizeOf('h1')).toBeLessThanOrEqual(1.75);
    expect(sizeOf('h2')).toBeLessThan(sizeOf('h1'));
    expect(sizeOf('h3')).toBeLessThan(sizeOf('h2'));
  });
});
