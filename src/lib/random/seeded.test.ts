import { describe, expect, it } from 'vitest';
import { chance, createRandom, floatBetween, intBetween, pick, seedAt } from './seeded';

function draw(seed: number, count: number): number[] {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => random());
}

describe('createRandom', () => {
  it('produces the same stream for the same seed', () => {
    expect(draw(42, 20)).toEqual(draw(42, 20));
  });

  it('produces different streams for different seeds', () => {
    expect(draw(1, 10)).not.toEqual(draw(2, 10));
  });

  it('stays within [0, 1) across a long run', () => {
    const random = createRandom(7);
    const bad: string[] = [];

    // Collected rather than asserted per draw: 200,000 expect() calls cost
    // seconds, and a count tells you far less than the offending draw does.
    for (let i = 0; i < 200_000 && bad.length < 5; i += 1) {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) bad.push(`draw ${i}: ${value}`);
    }

    expect(bad).toEqual([]);
  });

  it('handles a zero seed', () => {
    expect(draw(0, 5).every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('handles the largest 32-bit seed', () => {
    expect(draw(0xffffffff, 5).every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('handles a negative seed by coercing to unsigned', () => {
    expect(draw(-1, 5)).toEqual(draw(0xffffffff, 5));
  });

  it('does not immediately repeat itself', () => {
    const values = draw(123, 1000);
    expect(new Set(values).size).toBeGreaterThan(990);
  });
});

describe('seedAt', () => {
  it('is deterministic', () => {
    expect(seedAt(9, 4)).toBe(seedAt(9, 4));
  });

  it('gives neighbouring indices unrelated seeds', () => {
    expect(seedAt(9, 4)).not.toBe(seedAt(9, 5));
  });

  it('separates the same index under different seeds', () => {
    expect(seedAt(1, 100)).not.toBe(seedAt(2, 100));
  });

  it('rarely collides across a large index range', () => {
    const seeds = new Set(Array.from({ length: 50_000 }, (_, i) => seedAt(20260901, i)));
    expect(seeds.size).toBeGreaterThan(49_900);
  });

  it('always returns a non-negative 32-bit integer', () => {
    for (const index of [0, 1, 999, 99_999, 1_000_000]) {
      const value = seedAt(20260901, index);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('helpers', () => {
  it('picks only from the supplied list', () => {
    const random = createRandom(3);
    const items = ['a', 'b', 'c'];

    for (let i = 0; i < 500; i += 1) {
      expect(items).toContain(pick(random, items));
    }
  });

  it('returns the only element of a single-item list', () => {
    expect(pick(createRandom(3), ['only'])).toBe('only');
  });

  it('keeps intBetween inside an inclusive range', () => {
    const random = createRandom(11);
    const seen = new Set<number>();

    for (let i = 0; i < 2000; i += 1) {
      const value = intBetween(random, 3, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }

    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('returns the bound when intBetween has no range', () => {
    expect(intBetween(createRandom(1), 5, 5)).toBe(5);
  });

  it('keeps floatBetween inside a half-open range', () => {
    const random = createRandom(13);

    for (let i = 0; i < 2000; i += 1) {
      const value = floatBetween(random, -1, 1);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThan(1);
    }
  });

  it('treats a probability of 0 and 1 as certainties', () => {
    const random = createRandom(17);

    for (let i = 0; i < 500; i += 1) {
      expect(chance(random, 0)).toBe(false);
    }

    const other = createRandom(17);
    for (let i = 0; i < 500; i += 1) {
      expect(chance(other, 1)).toBe(true);
    }
  });

  it('lands near the requested probability over many draws', () => {
    const random = createRandom(19);
    let hits = 0;

    for (let i = 0; i < 20_000; i += 1) {
      if (chance(random, 0.25)) hits += 1;
    }

    expect(hits / 20_000).toBeCloseTo(0.25, 1);
  });
});
