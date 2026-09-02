import { describe, expect, it } from 'vitest';
import { DOCUMENT_TYPES } from '@/domain/document';
import { MEDIUM_CONFIDENCE } from '@/domain/confidence';
import { PROCESSING_ERROR_CODES } from '@/domain/errors';
import { PROCESSING_STATUSES, type ProcessingStatus } from '@/domain/status';
import {
  ARCHIVE_END,
  ARCHIVE_SPAN_DAYS,
  MAX_PAGES,
  MIN_SIZE_BYTES,
  SIZE_RANGE_BYTES,
} from './config';
import { FIELD_COUNT, generateCore } from './generate';
import { LOCATION_POOL, NAME_POOL, PROGRAM_POOL } from './pools.generated';

const SEED = 20260901;
const SAMPLE = 20_000;

function statusOf(index: number, seed = SEED): ProcessingStatus {
  return PROCESSING_STATUSES[generateCore(seed, index).statusId] as ProcessingStatus;
}

function indicesWithStatus(status: ProcessingStatus, limit = 200): number[] {
  const found: number[] = [];

  for (let index = 0; index < SAMPLE && found.length < limit; index += 1) {
    if (statusOf(index) === status) found.push(index);
  }

  return found;
}

describe('determinism', () => {
  it('returns identical output for the same seed and index', () => {
    expect(generateCore(SEED, 4211)).toEqual(generateCore(SEED, 4211));
  });

  it('addresses index 0 and very large indices alike', () => {
    for (const index of [0, 1, 99_999, 1_000_000]) {
      expect(generateCore(SEED, index)).toEqual(generateCore(SEED, index));
    }
  });

  it('gives different documents to different indices', () => {
    expect(generateCore(SEED, 10)).not.toEqual(generateCore(SEED, 11));
  });

  it('produces a different archive under a different seed', () => {
    const a = Array.from({ length: 500 }, (_, i) => generateCore(1, i).nameId);
    const b = Array.from({ length: 500 }, (_, i) => generateCore(2, i).nameId);

    expect(a).not.toEqual(b);
  });

  it('works with a zero seed', () => {
    expect(() => generateCore(0, 0)).not.toThrow();
  });
});

describe('value ranges', () => {
  it('keeps every scalar inside its column type', () => {
    for (let index = 0; index < SAMPLE; index += 1) {
      const core = generateCore(SEED, index);

      expect(core.statusId).toBeGreaterThanOrEqual(0);
      expect(core.statusId).toBeLessThan(PROCESSING_STATUSES.length);
      expect(core.docTypeId).toBeLessThan(DOCUMENT_TYPES.length);
      expect(core.nameId).toBeLessThan(NAME_POOL.length);
      expect(core.locationId).toBeLessThan(LOCATION_POOL.length);
      expect(core.programId).toBeLessThan(PROGRAM_POOL.length);
      expect(core.errorId).toBeLessThanOrEqual(PROCESSING_ERROR_CODES.length);
      expect(core.pageCount).toBeGreaterThanOrEqual(1);
      expect(core.pageCount).toBeLessThanOrEqual(MAX_PAGES);
      expect(core.missingMask).toBeLessThan(1 << FIELD_COUNT);
      expect(core.attempts).toBeLessThan(256);
    }
  });

  it('keeps file size inside the declared band', () => {
    for (let index = 0; index < SAMPLE; index += 1) {
      const { sizeBytes } = generateCore(SEED, index);

      expect(sizeBytes).toBeGreaterThanOrEqual(MIN_SIZE_BYTES);
      expect(sizeBytes).toBeLessThan(MIN_SIZE_BYTES + SIZE_RANGE_BYTES);
    }
  });

  it('dates every document inside the archive window and never in the future', () => {
    const earliest = ARCHIVE_END - ARCHIVE_SPAN_DAYS * 86_400_000 - 86_400_000;

    for (let index = 0; index < SAMPLE; index += 1) {
      const { uploadedAt } = generateCore(SEED, index);

      expect(uploadedAt).toBeGreaterThan(earliest);
      expect(uploadedAt).toBeLessThanOrEqual(ARCHIVE_END);
    }
  });

  it('keeps every confidence inside the unit interval', () => {
    for (let index = 0; index < SAMPLE; index += 1) {
      const core = generateCore(SEED, index);

      expect(core.fieldConfidence).toHaveLength(FIELD_COUNT);

      for (const value of core.fieldConfidence) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }

      expect(core.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(core.overallConfidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('status invariants', () => {
  it('produces every status', () => {
    const seen = new Set(Array.from({ length: SAMPLE }, (_, i) => statusOf(i)));

    for (const status of PROCESSING_STATUSES) {
      expect(seen).toContain(status);
    }
  });

  it('roughly follows the configured weights', () => {
    const counts = new Map<ProcessingStatus, number>();

    for (let index = 0; index < SAMPLE; index += 1) {
      const status = statusOf(index);
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }

    expect((counts.get('completed') ?? 0) / SAMPLE).toBeCloseTo(0.72, 1);
    expect((counts.get('failed') ?? 0) / SAMPLE).toBeCloseTo(0.07, 1);
  });

  it('gives failed documents an error and at least one attempt', () => {
    const failed = indicesWithStatus('failed');
    expect(failed.length).toBeGreaterThan(0);

    for (const index of failed) {
      const core = generateCore(SEED, index);

      expect(core.errorId).toBeGreaterThan(0);
      expect(PROCESSING_ERROR_CODES[core.errorId - 1]).toBeDefined();
      expect(core.attempts).toBeGreaterThanOrEqual(1);
    }
  });

  it('never attaches an error to a document that did not fail', () => {
    for (let index = 0; index < SAMPLE; index += 1) {
      if (statusOf(index) === 'failed') continue;
      expect(generateCore(SEED, index).errorId).toBe(0);
    }
  });

  it('leaves no extracted values on documents that never finished extraction', () => {
    const allMissing = (1 << FIELD_COUNT) - 1;

    for (let index = 0; index < SAMPLE; index += 1) {
      const status = statusOf(index);
      if (status === 'completed' || status === 'needs_review') continue;

      const core = generateCore(SEED, index);

      expect(core.missingMask).toBe(allMissing);
      expect(core.overallConfidence).toBe(0);
      expect(core.fieldConfidence.every((value) => value === 0)).toBe(true);
    }
  });

  it('never leaves a completed document needing review', () => {
    const completed = indicesWithStatus('completed', 500);
    expect(completed.length).toBeGreaterThan(0);

    for (const index of completed) {
      const core = generateCore(SEED, index);

      expect(core.missingMask).toBe(0);
      for (const value of core.fieldConfidence) {
        expect(value).toBeGreaterThanOrEqual(MEDIUM_CONFIDENCE);
      }
    }
  });

  it('always gives a needs_review document something to actually review', () => {
    const review = indicesWithStatus('needs_review', 500);
    expect(review.length).toBeGreaterThan(0);

    for (const index of review) {
      const core = generateCore(SEED, index);
      const uncertain = core.fieldConfidence.some(
        (value, i) => (core.missingMask & (1 << i)) !== 0 || value < MEDIUM_CONFIDENCE,
      );

      expect(uncertain).toBe(true);
    }
  });

  it('holds the review invariant across the whole sample, not just a slice', () => {
    for (let index = 0; index < SAMPLE; index += 1) {
      if (statusOf(index) !== 'needs_review') continue;

      const core = generateCore(SEED, index);
      const uncertain = core.fieldConfidence.some(
        (value, i) => (core.missingMask & (1 << i)) !== 0 || value < MEDIUM_CONFIDENCE,
      );

      expect(uncertain).toBe(true);
    }
  });

  it('leaves pending documents unattempted', () => {
    for (const index of indicesWithStatus('pending')) {
      expect(generateCore(SEED, index).attempts).toBe(0);
    }
  });
});

describe('overallConfidence', () => {
  it('averages the field confidences for extracted documents', () => {
    for (const index of [
      ...indicesWithStatus('completed', 100),
      ...indicesWithStatus('needs_review', 100),
    ]) {
      const core = generateCore(SEED, index);
      const mean = core.fieldConfidence.reduce((sum, value) => sum + value, 0) / FIELD_COUNT;

      expect(core.overallConfidence).toBeCloseTo(mean, 10);
    }
  });
});
