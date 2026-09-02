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
import { FIELD_COUNT, generateCore, type DocumentCore } from './generate';
import { LOCATION_POOL, NAME_POOL, PROGRAM_POOL } from './pools.generated';

const SEED = 20260901;
const SAMPLE = 20_000;
const MAX_REPORTED = 5;

function statusOf(index: number, seed = SEED): ProcessingStatus {
  return PROCESSING_STATUSES[generateCore(seed, index).statusId] as ProcessingStatus;
}

/**
 * Scans the sample and returns the first few violations. Asserting inside the
 * loop would mean tens of thousands of expect() calls, which is slow enough to
 * time out on CI and reports a bare failure rather than the offending document.
 */
function scan(check: (core: DocumentCore, index: number) => string | null): string[] {
  const found: string[] = [];

  for (let index = 0; index < SAMPLE && found.length < MAX_REPORTED; index += 1) {
    const problem = check(generateCore(SEED, index), index);
    if (problem) found.push(`#${index}: ${problem}`);
  }

  return found;
}

function indicesWithStatus(status: ProcessingStatus, limit = 200): number[] {
  const found: number[] = [];

  for (let index = 0; index < SAMPLE && found.length < limit; index += 1) {
    if (statusOf(index) === status) found.push(index);
  }

  return found;
}

function isUncertain(core: DocumentCore): boolean {
  return core.fieldConfidence.some(
    (value, i) => (core.missingMask & (1 << i)) !== 0 || value < MEDIUM_CONFIDENCE,
  );
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
    expect(
      scan((core) => {
        if (core.statusId < 0 || core.statusId >= PROCESSING_STATUSES.length) return 'statusId';
        if (core.docTypeId >= DOCUMENT_TYPES.length) return 'docTypeId';
        if (core.nameId >= NAME_POOL.length) return 'nameId';
        if (core.locationId >= LOCATION_POOL.length) return 'locationId';
        if (core.programId >= PROGRAM_POOL.length) return 'programId';
        if (core.errorId > PROCESSING_ERROR_CODES.length) return 'errorId';
        if (core.pageCount < 1 || core.pageCount > MAX_PAGES) return 'pageCount';
        if (core.missingMask >= 1 << FIELD_COUNT) return 'missingMask';
        if (core.attempts >= 256) return 'attempts overflows Uint8Array';
        return null;
      }),
    ).toEqual([]);
  });

  it('keeps file size inside the declared band', () => {
    expect(
      scan(({ sizeBytes }) =>
        sizeBytes >= MIN_SIZE_BYTES && sizeBytes < MIN_SIZE_BYTES + SIZE_RANGE_BYTES
          ? null
          : `sizeBytes ${sizeBytes}`,
      ),
    ).toEqual([]);
  });

  it('dates every document inside the archive window and never in the future', () => {
    const earliest = ARCHIVE_END - ARCHIVE_SPAN_DAYS * 86_400_000 - 86_400_000;

    expect(
      scan(({ uploadedAt }) =>
        uploadedAt > earliest && uploadedAt <= ARCHIVE_END ? null : `uploadedAt ${uploadedAt}`,
      ),
    ).toEqual([]);
  });

  it('keeps every confidence inside the unit interval', () => {
    expect(
      scan((core) => {
        if (core.fieldConfidence.length !== FIELD_COUNT) return 'wrong field count';
        if (core.fieldConfidence.some((value) => value < 0 || value > 1)) return 'field confidence';
        if (core.overallConfidence < 0 || core.overallConfidence > 1) return 'overall confidence';
        return null;
      }),
    ).toEqual([]);
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
    expect(indicesWithStatus('failed').length).toBeGreaterThan(0);

    expect(
      scan((core, index) => {
        if (statusOf(index) !== 'failed') return null;
        if (core.errorId < 1 || core.errorId > PROCESSING_ERROR_CODES.length)
          return 'no error code';
        if (core.attempts < 1) return 'no attempt recorded';
        return null;
      }),
    ).toEqual([]);
  });

  it('never attaches an error to a document that did not fail', () => {
    expect(
      scan((core, index) =>
        statusOf(index) !== 'failed' && core.errorId !== 0 ? `errorId ${core.errorId}` : null,
      ),
    ).toEqual([]);
  });

  it('leaves no extracted values on documents that never finished extraction', () => {
    const allMissing = (1 << FIELD_COUNT) - 1;

    expect(
      scan((core, index) => {
        const status = statusOf(index);
        if (status === 'completed' || status === 'needs_review') return null;
        if (core.missingMask !== allMissing) return 'has extracted fields';
        if (core.overallConfidence !== 0) return 'carries confidence';
        return null;
      }),
    ).toEqual([]);
  });

  it('never leaves a completed document needing review', () => {
    expect(indicesWithStatus('completed', 500).length).toBeGreaterThan(0);

    expect(
      scan((core, index) => {
        if (statusOf(index) !== 'completed') return null;
        if (core.missingMask !== 0) return 'has a missing field';
        if (core.fieldConfidence.some((value) => value < MEDIUM_CONFIDENCE))
          return 'low confidence';
        return null;
      }),
    ).toEqual([]);
  });

  it('always gives a needs_review document something to actually review', () => {
    expect(indicesWithStatus('needs_review', 500).length).toBeGreaterThan(0);

    expect(
      scan((core, index) =>
        statusOf(index) === 'needs_review' && !isUncertain(core) ? 'nothing to review' : null,
      ),
    ).toEqual([]);
  });

  it('leaves pending documents unattempted', () => {
    expect(
      scan((core, index) =>
        statusOf(index) === 'pending' && core.attempts !== 0 ? `attempts ${core.attempts}` : null,
      ),
    ).toEqual([]);
  });
});

describe('overallConfidence', () => {
  it('averages the field confidences for extracted documents', () => {
    const extracted = [
      ...indicesWithStatus('completed', 100),
      ...indicesWithStatus('needs_review', 100),
    ];

    for (const index of extracted) {
      const core = generateCore(SEED, index);
      const mean = core.fieldConfidence.reduce((sum, value) => sum + value, 0) / FIELD_COUNT;

      expect(core.overallConfidence).toBeCloseTo(mean, 10);
    }
  });
});
