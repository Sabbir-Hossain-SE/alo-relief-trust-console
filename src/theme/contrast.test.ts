import { describe, expect, it } from 'vitest';
import { PROCESSING_STATUSES } from '@/domain/status';
import { AA_TEXT, AA_UI, blend, contrastRatio, relativeLuminance } from './contrast';
import { brand, brandMark, statusTones, surfaces } from './tokens';

/**
 * The guard, not a one-off check. The first palette looked calm and failed
 * contrast on every status, so these assertions exist to make that impossible to
 * reintroduce the next time anyone tunes a colour.
 *
 * Each tone is checked against both backgrounds it can land on — cards sit on
 * `surface`, page-level states sit on `ground` — and the worse of the two has to
 * pass.
 */
const SCHEMES = ['light', 'dark'] as const;

/** Matches the alpha StatusChip tints its background with. */
const CHIP_TINT_ALPHA = 0.12;

function worstAgainstBackgrounds(color: string, scheme: (typeof SCHEMES)[number]): number {
  const { surface, ground } = surfaces[scheme];
  return Math.min(contrastRatio(color, surface), contrastRatio(color, ground));
}

describe('contrastRatio', () => {
  it('gives the known extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('does not care which colour is given first', () => {
    expect(contrastRatio('#2F6F63', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#2F6F63'),
      10,
    );
  });

  it('accepts a hex colour with or without the hash', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(relativeLuminance('FFFFFF'), 10);
  });

  it('rejects anything that is not a six-digit hex colour', () => {
    for (const bad of ['', '#FFF', 'white', '#GGGGGG', '#12345', '#1234567']) {
      expect(() => relativeLuminance(bad)).toThrow();
    }
  });
});

describe('status ink is legible as text', () => {
  for (const scheme of SCHEMES) {
    for (const status of PROCESSING_STATUSES) {
      it(`${status} on ${scheme}`, () => {
        const { ink } = statusTones[scheme][status];
        expect(worstAgainstBackgrounds(ink, scheme)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }
});

describe('status ink stays legible on its own tinted chip', () => {
  // A chip tints its background with the fill at low alpha, so this is the
  // pairing a reader actually sees — checking ink against the bare surface would
  // miss it.
  for (const scheme of SCHEMES) {
    for (const status of PROCESSING_STATUSES) {
      it(`${status} on ${scheme}`, () => {
        const { fill, ink } = statusTones[scheme][status];
        const tinted = blend(fill, surfaces[scheme].surface, CHIP_TINT_ALPHA);

        expect(contrastRatio(ink, tinted)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }
});

describe('every status stays visually distinct from its neighbours', () => {
  for (const scheme of SCHEMES) {
    it(`on ${scheme}`, () => {
      const inks = PROCESSING_STATUSES.map((status) => statusTones[scheme][status].ink);
      expect(new Set(inks).size).toBe(inks.length);
    });
  }
});

describe('brand colours', () => {
  it('keeps primary legible as text in both schemes', () => {
    expect(worstAgainstBackgrounds(brand.primary.light, 'light')).toBeGreaterThanOrEqual(AA_TEXT);
    expect(worstAgainstBackgrounds(brand.primary.dark, 'dark')).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('keeps accent ink usable for meaningful UI', () => {
    expect(worstAgainstBackgrounds(brand.accentInk.light, 'light')).toBeGreaterThanOrEqual(AA_UI);
    expect(worstAgainstBackgrounds(brand.accentInk.dark, 'dark')).toBeGreaterThanOrEqual(AA_UI);
  });

  it('records that the decorative accent is not safe for text', () => {
    // Documented deliberately: the apricot is a fill. Anything readable uses
    // accentInk, and this assertion is what stops the two being swapped.
    expect(worstAgainstBackgrounds(brand.accent.light, 'light')).toBeLessThan(AA_TEXT);
  });
});

describe('body and muted text', () => {
  for (const scheme of SCHEMES) {
    it(`is legible on ${scheme}`, () => {
      const { text, textMuted } = surfaces[scheme];
      expect(worstAgainstBackgrounds(text, scheme)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(worstAgainstBackgrounds(textMuted, scheme)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }
});

describe('the brand mark stays visible on its own ground', () => {
  /**
   * The horizon is the only part of the mark that follows the scheme, and it is
   * the part that gives the drawing its base. At a mid grey it would clear
   * neither ground and the mark would read as a floating sun in both.
   */
  for (const scheme of SCHEMES) {
    it(`keeps the horizon above the graphics threshold in ${scheme}`, () => {
      const ratio = contrastRatio(brandMark.horizon[scheme], surfaces[scheme].ground);

      expect(ratio).toBeGreaterThanOrEqual(AA_UI);
    });
  }

  /**
   * No threshold on the sun, deliberately. It is a warm fill on warm paper at
   * 1.8:1 and could not reach 3:1 without becoming a different colour — the
   * same trade the accent token already records. It is decoration, hidden from
   * assistive technology, and the horizon is what carries the mark; a number
   * here would be one fitted to whatever the palette happened to be.
   */
});
