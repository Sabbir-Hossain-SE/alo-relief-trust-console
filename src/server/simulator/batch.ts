import { PROCESSING_STATUSES, type ProcessingStatus } from '@/domain/status';
import type { ColumnStore } from '../corpus/columnStore';
import { summaryAt } from '../corpus/documentAt';
import { applyPatch, type Overlay } from '../corpus/overlay';
import { DEFAULT_SIMULATOR_CONFIG, type SimulatorConfig } from './config';
import { outcomeFor } from './outcome';

export type Batch = {
  id: string;
  label: string;
  createdAt: number;
  /** Documents in this batch, in the order they are worked through. */
  indices: Uint32Array;
  /** How far through `indices` processing has started. */
  cursor: number;
  /** Document index → the time its current attempt finishes. */
  inFlight: Map<number, number>;
  /** Attempts already made per document, so a retry can differ from the first run. */
  attempts: Map<number, number>;
  /**
   * The simulation's own clock. Work is scheduled against this rather than the
   * caller's wall clock, so a late poll or a backgrounded tab lands in exactly
   * the same place as steady ticks.
   */
  clock: number;
  finishedCount: number;
  settledAt: number | null;
};

export type BatchSummary = {
  id: string;
  label: string;
  createdAt: number;
  total: number;
  counts: Record<ProcessingStatus, number>;
  /** True once nothing is pending or processing. */
  settled: boolean;
  /** Documents finished per second so far, or null before anything finishes. */
  throughput: number | null;
  estimatedRemainingMs: number | null;
};

/**
 * Starts a batch with every document queued and nothing in flight.
 *
 * The documents are reset to pending in the overlay. Without that, whatever
 * status the corpus generated for those indices would leak into the batch and
 * its summary would describe the archive rather than this upload.
 */
export function createBatch(
  overlay: Overlay,
  id: string,
  label: string,
  indices: Uint32Array,
  createdAt: number,
): Batch {
  for (const index of indices) {
    applyPatch(overlay, index, {
      status: 'pending',
      errorCode: null,
      attempts: 0,
      batchId: id,
    });
  }

  return {
    id,
    label,
    createdAt,
    indices,
    cursor: 0,
    inFlight: new Map(),
    attempts: new Map(),
    clock: createdAt,
    finishedCount: 0,
    settledAt: indices.length === 0 ? createdAt : null,
  };
}

// Reports whether every document in the batch has reached a final state.
export function isSettled(batch: Batch): boolean {
  return batch.inFlight.size === 0 && batch.cursor >= batch.indices.length;
}

/**
 * Advances the batch up to `now`.
 *
 * A discrete-event loop rather than a fixed step: fill the workers, jump to the
 * next completion, repeat until the next one falls after `now`. The caller can
 * therefore poll at any interval, poll late, or skip hours ahead, and land in
 * exactly the state steady ticks would have produced.
 */
export function advanceBatch(
  overlay: Overlay,
  batch: Batch,
  seed: number,
  now: number,
  config: SimulatorConfig = DEFAULT_SIMULATOR_CONFIG,
): Batch {
  // Fill the workers, jump to the next completion, repeat. Scheduling against
  // the batch's own clock is what makes a single large step land in the same
  // state as many small ones.
  for (;;) {
    startPending(overlay, batch, batch.clock, config);

    if (batch.inFlight.size === 0) break;

    const next = earliestFinish(batch);
    if (next > now) break;

    batch.clock = next;
    finishDue(overlay, batch, seed, next, config);
  }

  if (now > batch.clock) batch.clock = now;

  if (batch.settledAt === null && isSettled(batch)) {
    batch.settledAt = batch.clock;
  }

  return batch;
}

function earliestFinish(batch: Batch): number {
  let earliest = Infinity;
  for (const finishesAt of batch.inFlight.values()) {
    if (finishesAt < earliest) earliest = finishesAt;
  }
  return earliest;
}

// Resolves every in-flight document whose service time has elapsed.
function finishDue(
  overlay: Overlay,
  batch: Batch,
  seed: number,
  now: number,
  config: SimulatorConfig,
): void {
  for (const [index, finishesAt] of batch.inFlight) {
    if (finishesAt > now) continue;

    const attempt = batch.attempts.get(index) ?? 1;
    const outcome = outcomeFor(seed, index, attempt, config);

    applyPatch(overlay, index, {
      status: outcome.status,
      errorCode: outcome.status === 'failed' ? outcome.errorCode : null,
      attempts: attempt,
      processedAt: finishesAt,
      batchId: batch.id,
    });

    batch.inFlight.delete(index);
    batch.finishedCount += 1;
  }
}

// Moves queued documents into processing, up to the concurrency limit.
function startPending(overlay: Overlay, batch: Batch, now: number, config: SimulatorConfig): void {
  while (batch.inFlight.size < config.concurrency && batch.cursor < batch.indices.length) {
    const index = batch.indices[batch.cursor] as number;
    batch.cursor += 1;

    const attempt = (batch.attempts.get(index) ?? 0) + 1;
    batch.attempts.set(index, attempt);

    applyPatch(overlay, index, {
      status: 'processing',
      attempts: attempt,
      batchId: batch.id,
    });

    batch.inFlight.set(index, now + config.serviceTimeMs);
  }
}

/**
 * Queues failed documents for another attempt.
 *
 * Only the given indices are requeued; deciding which failures are worth
 * retrying belongs to the caller, since it depends on the error code.
 */
export function requeue(batch: Batch, overlay: Overlay, indices: readonly number[]): number {
  if (indices.length === 0) return 0;

  const requeued = Uint32Array.from(indices);
  const remaining = batch.indices.subarray(batch.cursor);
  const merged = new Uint32Array(remaining.length + requeued.length);

  merged.set(remaining, 0);
  merged.set(requeued, remaining.length);

  batch.indices = merged;
  batch.cursor = 0;
  batch.settledAt = null;

  for (const index of indices) {
    applyPatch(overlay, index, { status: 'pending', errorCode: null });
  }

  return indices.length;
}

/**
 * Aggregates the batch into the four-way split.
 *
 * A batch of any size is almost never simply done or failed, so this reports
 * every status rather than collapsing to a pass/fail the interface would then
 * have to un-collapse.
 */
export function summarizeBatch(
  store: ColumnStore,
  overlay: Overlay,
  batch: Batch,
  now: number,
): BatchSummary {
  const counts = Object.fromEntries(PROCESSING_STATUSES.map((status) => [status, 0])) as Record<
    ProcessingStatus,
    number
  >;

  for (const index of batch.indices) {
    counts[summaryAt(store, overlay, index).status] += 1;
  }

  const total = batch.indices.length;
  const settled = isSettled(batch);
  const elapsed = Math.max(1, (batch.settledAt ?? now) - batch.createdAt);
  const throughput = batch.finishedCount > 0 ? (batch.finishedCount / elapsed) * 1000 : null;
  const outstanding = counts.pending + counts.processing;

  return {
    id: batch.id,
    label: batch.label,
    createdAt: batch.createdAt,
    total,
    counts,
    settled,
    throughput,
    estimatedRemainingMs:
      settled || throughput === null || throughput === 0
        ? null
        : Math.round((outstanding / throughput) * 1000),
  };
}
