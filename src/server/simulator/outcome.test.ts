import { describe, expect, it } from 'vitest';
import { isRetryable } from '@/domain/errors';
import { DEFAULT_SIMULATOR_CONFIG, type SimulatorConfig } from './config';
import { outcomeFor } from './outcome';

const SEED = 20260901;
const SAMPLE = 4000;

function config(overrides: Partial<SimulatorConfig> = {}): SimulatorConfig {
  return { ...DEFAULT_SIMULATOR_CONFIG, ...overrides };
}

function rateOf(status: string, attempt: number, cfg = config()): number {
  let hits = 0;
  for (let index = 0; index < SAMPLE; index += 1) {
    if (outcomeFor(SEED, index, attempt, cfg).status === status) hits += 1;
  }
  return hits / SAMPLE;
}

describe('determinism', () => {
  it('returns the same outcome for the same document and attempt', () => {
    expect(outcomeFor(SEED, 17, 1, config())).toEqual(outcomeFor(SEED, 17, 1, config()));
  });

  it('gives different documents independent outcomes', () => {
    const first = Array.from({ length: 200 }, (_, i) => outcomeFor(SEED, i, 1, config()).status);
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  it('produces a different run under a different seed', () => {
    const a = Array.from({ length: 300 }, (_, i) => outcomeFor(1, i, 1, config()).status);
    const b = Array.from({ length: 300 }, (_, i) => outcomeFor(2, i, 1, config()).status);

    expect(a).not.toEqual(b);
  });
});

describe('attempt sensitivity', () => {
  it('can decide differently on a later attempt', () => {
    // Without this the retry flow would be theatre: a failed document would
    // fail identically forever.
    const changed = Array.from({ length: SAMPLE }, (_, i) => i).filter(
      (index) =>
        outcomeFor(SEED, index, 1, config()).status !== outcomeFor(SEED, index, 2, config()).status,
    );

    expect(changed.length).toBeGreaterThan(0);
  });

  it('fails less often on each successive attempt', () => {
    const first = rateOf('failed', 1);
    const second = rateOf('failed', 2);
    const third = rateOf('failed', 3);

    expect(second).toBeLessThan(first);
    expect(third).toBeLessThanOrEqual(second);
  });

  it('eventually settles almost everything', () => {
    expect(rateOf('completed', 4)).toBeGreaterThan(0.95);
  });

  it('treats attempt 0 and 1 as the same first run', () => {
    // Guards against an off-by-one in the decay exponent.
    expect(rateOf('failed', 0)).toBeCloseTo(rateOf('failed', 1), 1);
  });
});

describe('outcome distribution', () => {
  it('roughly follows the configured rates on a first attempt', () => {
    expect(rateOf('failed', 1)).toBeCloseTo(DEFAULT_SIMULATOR_CONFIG.failureRate, 1);
    expect(rateOf('needs_review', 1)).toBeCloseTo(DEFAULT_SIMULATOR_CONFIG.reviewRate, 1);
  });

  it('never fails when the failure rate is zero', () => {
    expect(rateOf('failed', 1, config({ failureRate: 0 }))).toBe(0);
  });

  it('always fails when the failure rate is one', () => {
    expect(rateOf('failed', 1, config({ failureRate: 1 }))).toBe(1);
  });

  it('produces only the three final states', () => {
    const seen = new Set(
      Array.from({ length: SAMPLE }, (_, i) => outcomeFor(SEED, i, 1, config()).status),
    );

    expect([...seen].sort()).toEqual(['completed', 'failed', 'needs_review']);
  });
});

describe('error codes', () => {
  it('attaches a code to every failure and to nothing else', () => {
    for (let index = 0; index < SAMPLE; index += 1) {
      const outcome = outcomeFor(SEED, index, 1, config());

      if (outcome.status === 'failed') expect(outcome.errorCode).toBeDefined();
      else expect(outcome).not.toHaveProperty('errorCode');
    }
  });

  it('can produce a file the pipeline will never read on a first attempt', () => {
    const codes = new Set<string>();

    for (let index = 0; index < SAMPLE; index += 1) {
      const outcome = outcomeFor(SEED, index, 1, config({ failureRate: 1 }));
      if (outcome.status === 'failed') codes.add(outcome.errorCode);
    }

    expect([...codes].some((code) => !isRetryable(code as never))).toBe(true);
  });

  it('only produces transient causes once a document is being retried', () => {
    // A document reaching a second attempt was already accepted once, so an
    // unsupported format or oversized file is no longer a plausible cause.
    for (let index = 0; index < SAMPLE; index += 1) {
      const outcome = outcomeFor(SEED, index, 2, config({ failureRate: 1 }));

      if (outcome.status === 'failed') expect(isRetryable(outcome.errorCode)).toBe(true);
    }
  });
});
