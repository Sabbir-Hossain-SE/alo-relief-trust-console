import type { BatchSummary } from '@/server/simulator/batch';
import { formatCount } from '@/lib/format/number';
import { formatDuration } from '@/lib/format/date';

/**
 * An estimate needs evidence. One document finishing out of fifty thousand says
 * almost nothing about the rest, and a confident "4 hours remaining" that
 * collapses to two minutes a moment later is worse than saying nothing.
 */
const MIN_SAMPLE = 8;

export type BatchProgress = {
  total: number;
  /** Documents that have reached a final state, whatever that state was. */
  finished: number;
  queued: number;
  running: number;
  completion: number;
};

// Splits a batch summary into the figures the monitor reports.
export function batchProgress(summary: BatchSummary): BatchProgress {
  const { counts, total } = summary;
  const finished = counts.completed + counts.failed + counts.needs_review;

  return {
    total,
    finished,
    queued: counts.pending,
    running: counts.processing,
    completion: total === 0 ? 1 : finished / total,
  };
}

// Renders throughput in whichever unit does not read as zero.
export function throughputLabel(throughput: number | null): string | null {
  if (throughput === null || throughput <= 0) return null;

  if (throughput >= 1) return `${throughput.toFixed(1)} docs/sec`;
  return `${Math.max(1, Math.round(throughput * 60))} docs/min`;
}

// Renders the remaining estimate, or nothing while there is too little to go on.
export function remainingLabel(summary: BatchSummary): string | null {
  if (summary.settled || summary.estimatedRemainingMs === null) return null;
  if (batchProgress(summary).finished < MIN_SAMPLE) return null;

  // "~under a second left" is worse than saying it plainly.
  if (summary.estimatedRemainingMs < 1000) return 'finishing';

  return `~${formatDuration(summary.estimatedRemainingMs)} left`;
}

/**
 * The sentence a screen reader hears.
 *
 * Failures are named rather than folded into a percentage, because they are the
 * part an operator has to act on.
 */
export function progressMessage(summary: BatchSummary): string {
  const { finished, total } = batchProgress(summary);
  const attention = summary.counts.failed + summary.counts.needs_review;

  const head = summary.settled
    ? `${summary.label} finished. ${formatCount(total)} documents processed`
    : `${summary.label}: ${formatCount(finished)} of ${formatCount(total)} documents processed`;

  return attention === 0 ? `${head}.` : `${head}, ${formatCount(attention)} needing attention.`;
}
