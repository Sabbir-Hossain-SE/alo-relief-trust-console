import { describe, expect, it } from 'vitest';
import type { BatchSummary } from '@/server/simulator/batch';
import { batchProgress, progressMessage, remainingLabel, throughputLabel } from './progress';

function summary(overrides: Partial<BatchSummary> = {}): BatchSummary {
  return {
    id: 'batch-1',
    label: 'March intake',
    createdAt: 0,
    total: 100,
    counts: { pending: 40, processing: 10, completed: 40, failed: 5, needs_review: 5 },
    failures: [{ code: 'ocr_timeout', count: 5, retryable: true }],
    retryableFailures: 5,
    settled: false,
    throughput: 4,
    estimatedRemainingMs: 12_000,
    ...overrides,
  };
}

describe('batchProgress', () => {
  it('counts every final state as finished, not only success', () => {
    expect(batchProgress(summary())).toMatchObject({ finished: 50, completion: 0.5 });
  });

  it('separates what is queued from what is moving', () => {
    expect(batchProgress(summary())).toMatchObject({ queued: 40, running: 10 });
  });

  it('treats an empty batch as complete rather than dividing by zero', () => {
    const empty = summary({
      total: 0,
      counts: { pending: 0, processing: 0, completed: 0, failed: 0, needs_review: 0 },
    });

    expect(batchProgress(empty).completion).toBe(1);
  });
});

describe('throughputLabel', () => {
  it('reports per second once there is at least one a second', () => {
    expect(throughputLabel(4.24)).toBe('4.2 docs/sec');
  });

  it('switches to per minute rather than rounding a slow rate to zero', () => {
    expect(throughputLabel(0.05)).toBe('3 docs/min');
  });

  it('says nothing before anything has finished', () => {
    expect(throughputLabel(null)).toBeNull();
    expect(throughputLabel(0)).toBeNull();
  });
});

describe('remainingLabel', () => {
  it('estimates once there is enough finished work to go on', () => {
    expect(remainingLabel(summary())).toBe('~12s left');
  });

  it('withholds an estimate drawn from too few documents', () => {
    const early = summary({
      counts: { pending: 96, processing: 2, completed: 2, failed: 0, needs_review: 0 },
    });

    expect(remainingLabel(early)).toBeNull();
  });

  it('says a sub-second estimate plainly rather than "~under a second left"', () => {
    expect(remainingLabel(summary({ estimatedRemainingMs: 400 }))).toBe('finishing');
  });

  it('says nothing once the batch has settled', () => {
    expect(remainingLabel(summary({ settled: true }))).toBeNull();
  });
});

describe('progressMessage', () => {
  it('names what needs attention rather than only a percentage', () => {
    expect(progressMessage(summary())).toBe(
      'March intake: 50 of 100 documents processed, 10 needing attention.',
    );
  });

  it('announces the finish differently from a tick', () => {
    const done = summary({
      settled: true,
      counts: { pending: 0, processing: 0, completed: 100, failed: 0, needs_review: 0 },
    });

    expect(progressMessage(done)).toBe('March intake finished. 100 documents processed.');
  });
});
