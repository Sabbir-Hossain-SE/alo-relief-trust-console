import { describe, expect, it } from 'vitest';
import { assertInRange, buildColumnStore, storeBytes } from './columnStore';
import { generateCore } from './generate';

const SEED = 20260901;

describe('buildColumnStore', () => {
  it('builds an empty archive without complaint', () => {
    const store = buildColumnStore(SEED, 0);

    expect(store.size).toBe(0);
    expect(store.statusId).toHaveLength(0);
    expect(store.uploadedAt).toHaveLength(0);
  });

  it('rejects a negative size', () => {
    expect(() => buildColumnStore(SEED, -1)).toThrow(RangeError);
  });

  it('rejects a fractional size', () => {
    expect(() => buildColumnStore(SEED, 10.5)).toThrow(RangeError);
  });

  it('rejects a non-numeric size', () => {
    expect(() => buildColumnStore(SEED, Number.NaN)).toThrow(RangeError);
  });

  it('sizes every column to the archive', () => {
    const store = buildColumnStore(SEED, 1000);

    expect(store.statusId).toHaveLength(1000);
    expect(store.nameId).toHaveLength(1000);
    expect(store.confidence).toHaveLength(1000);
    expect(store.uploadedAt).toHaveLength(1000);
  });

  it('matches the generator it was filled from', () => {
    const store = buildColumnStore(SEED, 500);

    for (const index of [0, 1, 249, 499]) {
      const core = generateCore(SEED, index);

      expect(store.statusId[index]).toBe(core.statusId);
      expect(store.nameId[index]).toBe(core.nameId);
      expect(store.errorId[index]).toBe(core.errorId);
      expect(store.uploadedAt[index]).toBe(core.uploadedAt);
      expect(store.confidence[index]).toBeCloseTo(core.overallConfidence, 6);
    }
  });

  it('builds an identical archive every time', () => {
    const a = buildColumnStore(SEED, 2000);
    const b = buildColumnStore(SEED, 2000);

    expect(Array.from(a.statusId)).toEqual(Array.from(b.statusId));
    expect(Array.from(a.nameId)).toEqual(Array.from(b.nameId));
    expect(Array.from(a.uploadedAt)).toEqual(Array.from(b.uploadedAt));
  });

  it('keeps a prefix stable when the archive grows', () => {
    const small = buildColumnStore(SEED, 100);
    const large = buildColumnStore(SEED, 1000);

    expect(Array.from(large.statusId.subarray(0, 100))).toEqual(Array.from(small.statusId));
  });

  it('does not overflow the byte-wide columns', () => {
    const store = buildColumnStore(SEED, 5000);

    for (let index = 0; index < store.size; index += 1) {
      const core = generateCore(SEED, index);

      expect(store.attempts[index]).toBe(core.attempts);
      expect(store.pageCount[index]).toBe(core.pageCount);
      expect(store.missingMask[index]).toBe(core.missingMask);
      expect(store.docTypeId[index]).toBe(core.docTypeId);
    }
  });
});

describe('storeBytes', () => {
  it('holds a 100,000-document archive in a few megabytes', () => {
    const store = buildColumnStore(SEED, 100_000);
    const megabytes = storeBytes(store) / 1_048_576;

    expect(megabytes).toBeLessThan(4);
    expect(megabytes).toBeGreaterThan(1);
  });

  it('scales linearly with the archive', () => {
    expect(storeBytes(buildColumnStore(SEED, 2000))).toBe(
      storeBytes(buildColumnStore(SEED, 1000)) * 2,
    );
  });

  it('is zero for an empty archive', () => {
    expect(storeBytes(buildColumnStore(SEED, 0))).toBe(0);
  });
});

describe('assertInRange', () => {
  const store = buildColumnStore(SEED, 10);

  it('accepts the first and last index', () => {
    expect(() => assertInRange(store, 0)).not.toThrow();
    expect(() => assertInRange(store, 9)).not.toThrow();
  });

  it('rejects indices just outside the archive', () => {
    expect(() => assertInRange(store, -1)).toThrow(RangeError);
    expect(() => assertInRange(store, 10)).toThrow(RangeError);
  });

  it('rejects fractional and non-numeric indices', () => {
    expect(() => assertInRange(store, 1.5)).toThrow(RangeError);
    expect(() => assertInRange(store, Number.NaN)).toThrow(RangeError);
    expect(() => assertInRange(store, Infinity)).toThrow(RangeError);
  });

  it('rejects every index on an empty archive', () => {
    expect(() => assertInRange(buildColumnStore(SEED, 0), 0)).toThrow(RangeError);
  });
});
