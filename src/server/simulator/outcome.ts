import { PROCESSING_ERROR_CODES, isRetryable, type ProcessingErrorCode } from '@/domain/errors';
import { createRandom, seedAt } from '@/lib/random/seeded';
import type { SimulatorConfig } from './config';

export type ProcessingOutcome =
  | { status: 'completed' }
  | { status: 'needs_review' }
  | { status: 'failed'; errorCode: ProcessingErrorCode };

const RETRYABLE_CODES = PROCESSING_ERROR_CODES.filter(isRetryable);
const TERMINAL_CODES = PROCESSING_ERROR_CODES.filter((code) => !isRetryable(code));

/**
 * Decides what happens to one document on one attempt.
 *
 * The attempt number is part of the seed on purpose. Were the outcome a pure
 * function of the document alone, a retried document would fail identically
 * forever and retry would be theatre. Mixing the attempt in means a second run
 * can genuinely succeed, which is what makes the retry flow worth building.
 */
export function outcomeFor(
  seed: number,
  index: number,
  attempt: number,
  config: SimulatorConfig,
): ProcessingOutcome {
  const random = createRandom(seedAt(seed ^ 0x5f3759df, index * 31 + attempt));

  // Retries clear transient problems, so later attempts fail less often.
  const decay = config.retryImprovement ** Math.max(0, attempt - 1);
  const failureRate = config.failureRate * decay;
  const reviewRate = config.reviewRate * decay;

  const roll = random();

  if (roll < failureRate) {
    return { status: 'failed', errorCode: pickErrorCode(random(), attempt) };
  }

  if (roll < failureRate + reviewRate) {
    return { status: 'needs_review' };
  }

  return { status: 'completed' };
}

/**
 * Picks why a document failed. A first attempt can turn up a file the pipeline
 * will never read; by the time something is being retried it has already been
 * accepted once, so only transient causes remain plausible.
 */
function pickErrorCode(roll: number, attempt: number): ProcessingErrorCode {
  if (attempt > 1) {
    return RETRYABLE_CODES[Math.floor(roll * RETRYABLE_CODES.length)] as ProcessingErrorCode;
  }

  // Roughly a third of first failures are the file itself, not the pipeline.
  if (roll < 0.34) {
    return TERMINAL_CODES[Math.floor((roll / 0.34) * TERMINAL_CODES.length)] as ProcessingErrorCode;
  }

  const scaled = (roll - 0.34) / 0.66;
  return RETRYABLE_CODES[Math.floor(scaled * RETRYABLE_CODES.length)] as ProcessingErrorCode;
}
