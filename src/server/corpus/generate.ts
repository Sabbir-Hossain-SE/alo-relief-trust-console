import { DOCUMENT_TYPES } from '@/domain/document';
import { PROCESSING_ERROR_CODES } from '@/domain/errors';
import { PROCESSING_STATUSES, type ProcessingStatus } from '@/domain/status';
import { MEDIUM_CONFIDENCE } from '@/domain/confidence';
import { createRandom, seedAt } from '@/lib/random/seeded';
import {
  ARCHIVE_END,
  ARCHIVE_SPAN_DAYS,
  MAX_PAGES,
  MIN_SIZE_BYTES,
  SIZE_RANGE_BYTES,
  STATUS_WEIGHTS,
} from './config';
import { LOCATION_POOL, NAME_POOL, PROGRAM_POOL } from './pools.generated';

export const FIELD_COUNT = 5;

const DAY_MS = 86_400_000;
const SECONDS_PER_DAY = 86_400;

// Scalar form of a document. Holds no strings and no nested objects, so the
// column store can be filled without allocating a record per row.
export type DocumentCore = {
  statusId: number;
  docTypeId: number;
  nameId: number;
  locationId: number;
  programId: number;
  uploadedAt: number;
  sizeBytes: number;
  pageCount: number;
  attempts: number;
  /** 0 means no error; otherwise the error code index plus one. */
  errorId: number;
  /** Bit i is set when field i produced no value. */
  missingMask: number;
  fieldConfidence: number[];
  overallConfidence: number;
};

// Picks a status from the weighted table.
function statusFromRoll(roll: number): ProcessingStatus {
  let cumulative = 0;

  for (const [status, weight] of STATUS_WEIGHTS) {
    cumulative += weight;
    if (roll < cumulative) return status;
  }

  return 'completed';
}

// Reports whether a status means extraction has produced values yet.
function hasExtraction(status: ProcessingStatus): boolean {
  return status === 'completed' || status === 'needs_review';
}

/**
 * Field quality is derived from the status rather than rolled independently, so
 * the archive cannot contain a completed document that still needs review, or a
 * failed document carrying extracted values.
 */
function deriveFields(
  status: ProcessingStatus,
  missingRolls: number[],
  confidenceRolls: number[],
): { missingMask: number; fieldConfidence: number[] } {
  if (!hasExtraction(status)) {
    return { missingMask: (1 << FIELD_COUNT) - 1, fieldConfidence: new Array(FIELD_COUNT).fill(0) };
  }

  const fieldConfidence: number[] = [];
  let missingMask = 0;

  if (status === 'completed') {
    // Completed means every field was read and trusted.
    for (let i = 0; i < FIELD_COUNT; i += 1) {
      fieldConfidence.push(MEDIUM_CONFIDENCE + (confidenceRolls[i] as number) * 0.3);
    }
    return { missingMask, fieldConfidence };
  }

  // needs_review: at least one field is missing or below the review threshold.
  for (let i = 0; i < FIELD_COUNT; i += 1) {
    const missingRoll = missingRolls[i] as number;
    const confidenceRoll = confidenceRolls[i] as number;

    if (missingRoll < 0.18) {
      missingMask |= 1 << i;
      fieldConfidence.push(0);
    } else if (missingRoll < 0.5) {
      fieldConfidence.push(confidenceRoll * MEDIUM_CONFIDENCE);
    } else {
      fieldConfidence.push(MEDIUM_CONFIDENCE + confidenceRoll * 0.3);
    }
  }

  const alreadyUncertain = fieldConfidence.some(
    (value, i) => (missingMask & (1 << i)) !== 0 || value < MEDIUM_CONFIDENCE,
  );

  if (!alreadyUncertain) {
    // Force the invariant rather than re-rolling, which would desync the stream.
    const forced = Math.floor((missingRolls[0] as number) * FIELD_COUNT);
    // Scaled below the threshold, not onto it, so the invariant holds strictly.
    fieldConfidence[forced] = (confidenceRolls[forced] as number) * (MEDIUM_CONFIDENCE - 0.01);
  }

  return { missingMask, fieldConfidence };
}

// Averages field confidence, ignoring documents that were never extracted.
function averageConfidence(status: ProcessingStatus, fieldConfidence: number[]): number {
  if (!hasExtraction(status)) return 0;
  return fieldConfidence.reduce((sum, value) => sum + value, 0) / FIELD_COUNT;
}

/**
 * Builds one document's scalar values from the seed and its index alone. Pure:
 * the same pair always yields the same result, which is what lets the archive be
 * addressed rather than stored.
 */
export function generateCore(seed: number, index: number): DocumentCore {
  const random = createRandom(seedAt(seed, index));

  // Every draw happens unconditionally so branching never desyncs the stream.
  const docTypeId = Math.floor(random() * DOCUMENT_TYPES.length);
  const nameId = Math.floor(random() * NAME_POOL.length);
  const locationId = Math.floor(random() * LOCATION_POOL.length);
  const programId = Math.floor(random() * PROGRAM_POOL.length);
  const daysAgo = Math.floor(random() * ARCHIVE_SPAN_DAYS);
  const secondsIntoDay = Math.floor(random() * SECONDS_PER_DAY);
  const sizeBytes = MIN_SIZE_BYTES + Math.floor(random() * SIZE_RANGE_BYTES);
  const pageCount = 1 + Math.floor(random() * MAX_PAGES);
  const statusRoll = random();
  const errorRoll = random();
  const attemptRoll = random();

  const missingRolls = Array.from({ length: FIELD_COUNT }, () => random());
  const confidenceRolls = Array.from({ length: FIELD_COUNT }, () => random());

  const status = statusFromRoll(statusRoll);
  const { missingMask, fieldConfidence } = deriveFields(status, missingRolls, confidenceRolls);

  return {
    statusId: PROCESSING_STATUSES.indexOf(status),
    docTypeId,
    nameId,
    locationId,
    programId,
    uploadedAt: ARCHIVE_END - daysAgo * DAY_MS - secondsIntoDay * 1000,
    sizeBytes,
    pageCount,
    attempts: status === 'failed' ? 1 + Math.floor(attemptRoll * 3) : 0,
    errorId: status === 'failed' ? 1 + Math.floor(errorRoll * PROCESSING_ERROR_CODES.length) : 0,
    missingMask,
    fieldConfidence,
    overallConfidence: averageConfidence(status, fieldConfidence),
  };
}
