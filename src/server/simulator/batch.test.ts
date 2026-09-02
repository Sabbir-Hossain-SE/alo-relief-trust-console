import { describe, expect, it } from 'vitest';
import { isRetryable } from '@/domain/errors';
import { PROCESSING_STATUSES } from '@/domain/status';
import { buildColumnStore } from '../corpus/columnStore';
import { summaryAt } from '../corpus/documentAt';
import { createOverlay, type Overlay } from '../corpus/overlay';
import { DEFAULT_SIMULATOR_CONFIG, type SimulatorConfig } from './config';
import { advanceBatch, createBatch, isSettled, requeue, summarizeBatch, type Batch } from './batch';

const SEED = 20260901;
const T0 = 1_760_000_000_000;
const store = buildColumnStore(SEED, 500);

function config(overrides: Partial<SimulatorConfig> = {}): SimulatorConfig {
  return { ...DEFAULT_SIMULATOR_CONFIG, ...overrides };
}

function setup(size: number, at = T0) {
  const overlay = createOverlay();
  const indices = Uint32Array.from({ length: size }, (_, i) => i);
  return { overlay, batch: createBatch(overlay, 'batch-1', 'Field intake', indices, at) };
}

// Advances in realistic polling steps until nothing is left in flight.
function runToCompletion(
  overlay: Overlay,
  batch: Batch,
  cfg = config(),
  step = 250,
  maxTicks = 5000,
): number {
  let now = T0;

  for (let tick = 0; tick < maxTicks; tick += 1) {
    now += step;
    advanceBatch(overlay, batch, SEED, now, cfg);
    if (isSettled(batch)) return now;
  }

  throw new Error('Batch never settled');
}

describe('createBatch', () => {
  it('starts with everything queued', () => {
    const { batch } = setup(20);

    expect(batch.cursor).toBe(0);
    expect(batch.inFlight.size).toBe(0);
    expect(batch.finishedCount).toBe(0);
  });

  it('treats an empty batch as already settled', () => {
    const { batch } = setup(0);

    expect(isSettled(batch)).toBe(true);
    expect(batch.settledAt).toBe(T0);
  });

  it('resets its documents to pending', () => {
    // The corpus generates a status for every index. Left alone, whatever the
    // archive already said about these documents would leak into the batch and
    // its summary would describe the archive rather than this upload.
    const { overlay, batch } = setup(120);
    const summary = summarizeBatch(store, overlay, batch, T0);

    expect(summary.counts.pending).toBe(120);
    expect(summary.counts.completed).toBe(0);
    expect(summary.counts.failed).toBe(0);
  });

  it('claims the documents for itself', () => {
    const { overlay, batch } = setup(10);
    runToCompletion(overlay, batch);

    for (const index of batch.indices) {
      expect(summaryAt(store, overlay, index).status).not.toBe('pending');
    }
  });
});

describe('progression', () => {
  it('moves documents into processing up to the concurrency limit', () => {
    const { overlay, batch } = setup(100);
    advanceBatch(overlay, batch, SEED, T0, config({ concurrency: 8 }));

    expect(batch.inFlight.size).toBe(8);

    const processing = [...batch.indices].filter(
      (index) => summaryAt(store, overlay, index).status === 'processing',
    );
    expect(processing).toHaveLength(8);
  });

  it('never exceeds the concurrency limit at any point', () => {
    const { overlay, batch } = setup(120);
    const cfg = config({ concurrency: 5 });
    let now = T0;

    for (let tick = 0; tick < 60; tick += 1) {
      now += 100;
      advanceBatch(overlay, batch, SEED, now, cfg);
      expect(batch.inFlight.size).toBeLessThanOrEqual(5);
    }
  });

  it('does nothing before any service time has elapsed', () => {
    const { overlay, batch } = setup(30);
    advanceBatch(overlay, batch, SEED, T0, config());

    expect(batch.finishedCount).toBe(0);
  });

  it('finishes work once its service time has passed', () => {
    const { overlay, batch } = setup(30);
    const cfg = config({ concurrency: 4, serviceTimeMs: 100 });

    advanceBatch(overlay, batch, SEED, T0, cfg);
    advanceBatch(overlay, batch, SEED, T0 + 100, cfg);

    expect(batch.finishedCount).toBe(4);
  });

  it('reaches a settled state where nothing is pending or processing', () => {
    const { overlay, batch } = setup(60);
    runToCompletion(overlay, batch);

    const counts = summarizeBatch(store, overlay, batch, T0 + 1_000_000).counts;
    expect(counts.pending + counts.processing).toBe(0);
    expect(isSettled(batch)).toBe(true);
  });

  it('leaves a settled batch alone on further ticks', () => {
    const { overlay, batch } = setup(20);
    const settledAt = runToCompletion(overlay, batch);
    const before = summarizeBatch(store, overlay, batch, settledAt);

    advanceBatch(overlay, batch, SEED, settledAt + 60_000, config());

    expect(summarizeBatch(store, overlay, batch, settledAt + 60_000).counts).toEqual(before.counts);
  });

  it('catches up correctly when the caller jumps far ahead', () => {
    // A poll can be late, or a tab backgrounded. One big step must land in the
    // same place as many small ones.
    const small = setup(80);
    runToCompletion(small.overlay, small.batch, config(), 250);

    const big = setup(80);
    advanceBatch(big.overlay, big.batch, SEED, T0 + 10_000_000, config());

    expect(isSettled(big.batch)).toBe(true);
    expect(summarizeBatch(store, big.overlay, big.batch, T0 + 10_000_000).counts).toEqual(
      summarizeBatch(store, small.overlay, small.batch, T0 + 10_000_000).counts,
    );
  });

  it('processes a single-document batch', () => {
    const { overlay, batch } = setup(1);
    runToCompletion(overlay, batch);

    expect(batch.finishedCount).toBe(1);
  });

  it('is reproducible for a given seed', () => {
    const first = setup(70);
    runToCompletion(first.overlay, first.batch);

    const second = setup(70);
    runToCompletion(second.overlay, second.batch);

    expect(summarizeBatch(store, first.overlay, first.batch, T0).counts).toEqual(
      summarizeBatch(store, second.overlay, second.batch, T0).counts,
    );
  });
});

describe('summarizeBatch', () => {
  it('accounts for every document exactly once', () => {
    const { overlay, batch } = setup(90);
    let now = T0;

    for (let tick = 0; tick < 12; tick += 1) {
      now += 200;
      advanceBatch(overlay, batch, SEED, now, config());

      const { counts, total } = summarizeBatch(store, overlay, batch, now);
      expect(Object.values(counts).reduce((sum, value) => sum + value, 0)).toBe(total);
    }
  });

  it('reports a partial outcome rather than a single pass or fail', () => {
    const { overlay, batch } = setup(400);
    const settledAt = runToCompletion(overlay, batch);
    const { counts } = summarizeBatch(store, overlay, batch, settledAt);

    // The whole point of the four-way split: a real batch lands in several
    // states at once.
    const nonEmpty = PROCESSING_STATUSES.filter((status) => counts[status] > 0);
    expect(nonEmpty.length).toBeGreaterThan(1);
    expect(counts.completed).toBeGreaterThan(0);
    expect(counts.failed + counts.needs_review).toBeGreaterThan(0);
  });

  it('has no throughput before anything finishes', () => {
    const { overlay, batch } = setup(20);
    advanceBatch(overlay, batch, SEED, T0, config());

    expect(summarizeBatch(store, overlay, batch, T0).throughput).toBeNull();
  });

  it('reports throughput once work completes', () => {
    const { overlay, batch } = setup(40);
    const cfg = config({ concurrency: 4, serviceTimeMs: 100 });

    advanceBatch(overlay, batch, SEED, T0, cfg);
    advanceBatch(overlay, batch, SEED, T0 + 1000, cfg);

    expect(summarizeBatch(store, overlay, batch, T0 + 1000).throughput).toBeGreaterThan(0);
  });

  it('stops estimating once the batch has settled', () => {
    const { overlay, batch } = setup(30);
    const settledAt = runToCompletion(overlay, batch);

    expect(summarizeBatch(store, overlay, batch, settledAt).estimatedRemainingMs).toBeNull();
  });

  it('estimates remaining time while work is outstanding', () => {
    const { overlay, batch } = setup(200);
    const cfg = config({ concurrency: 4, serviceTimeMs: 100 });

    advanceBatch(overlay, batch, SEED, T0, cfg);
    advanceBatch(overlay, batch, SEED, T0 + 1000, cfg);

    const estimate = summarizeBatch(store, overlay, batch, T0 + 1000).estimatedRemainingMs;
    expect(estimate).not.toBeNull();
    expect(estimate as number).toBeGreaterThan(0);
  });

  it('summarizes an empty batch without dividing by zero', () => {
    const { overlay, batch } = setup(0);
    const summary = summarizeBatch(store, overlay, batch, T0);

    expect(summary.total).toBe(0);
    expect(summary.settled).toBe(true);
    expect(summary.estimatedRemainingMs).toBeNull();
  });
});

describe('requeue', () => {
  function failedIndices(overlay: Overlay, batch: Batch): number[] {
    return [...batch.indices].filter(
      (index) => summaryAt(store, overlay, index).status === 'failed',
    );
  }

  it('puts failed documents back to pending', () => {
    const { overlay, batch } = setup(300);
    runToCompletion(overlay, batch);

    const failed = failedIndices(overlay, batch);
    expect(failed.length).toBeGreaterThan(0);

    requeue(batch, overlay, failed);

    for (const index of failed) {
      const summary = summaryAt(store, overlay, index);
      expect(summary.status).toBe('pending');
      expect(summary.errorCode).toBeUndefined();
    }
  });

  it('unsettles the batch so polling resumes', () => {
    const { overlay, batch } = setup(300);
    runToCompletion(overlay, batch);
    requeue(batch, overlay, failedIndices(overlay, batch));

    expect(isSettled(batch)).toBe(false);
    expect(batch.settledAt).toBeNull();
  });

  it('increments the attempt count on the retry', () => {
    const { overlay, batch } = setup(300);
    runToCompletion(overlay, batch);

    const failed = failedIndices(overlay, batch);
    const target = failed[0] as number;
    const before = summaryAt(store, overlay, target).attempts;

    requeue(batch, overlay, [target]);
    runToCompletion(overlay, batch);

    expect(summaryAt(store, overlay, target).attempts).toBeGreaterThan(before);
  });

  it('lets retried documents actually succeed', () => {
    const { overlay, batch } = setup(300);
    runToCompletion(overlay, batch);

    const failed = failedIndices(overlay, batch);
    const retryable = failed.filter((index) => {
      const code = summaryAt(store, overlay, index).errorCode;
      return code !== undefined && isRetryable(code);
    });
    expect(retryable.length).toBeGreaterThan(0);

    requeue(batch, overlay, retryable);
    runToCompletion(overlay, batch);

    const stillFailed = retryable.filter(
      (index) => summaryAt(store, overlay, index).status === 'failed',
    );
    expect(stillFailed.length).toBeLessThan(retryable.length);
  });

  it('does nothing when given no documents', () => {
    const { overlay, batch } = setup(50);
    const settledAt = runToCompletion(overlay, batch);
    const before = summarizeBatch(store, overlay, batch, settledAt).counts;

    expect(requeue(batch, overlay, [])).toBe(0);
    expect(isSettled(batch)).toBe(true);
    expect(summarizeBatch(store, overlay, batch, settledAt).counts).toEqual(before);
  });

  it('keeps the batch total honest after a retry', () => {
    const { overlay, batch } = setup(200);
    runToCompletion(overlay, batch);

    const failed = failedIndices(overlay, batch);
    requeue(batch, overlay, failed);
    const settledAt = runToCompletion(overlay, batch);

    const { counts, total } = summarizeBatch(store, overlay, batch, settledAt);
    expect(Object.values(counts).reduce((sum, value) => sum + value, 0)).toBe(total);
  });
});
