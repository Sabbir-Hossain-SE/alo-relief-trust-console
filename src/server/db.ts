import { correctField, type ExtractedField } from '@/domain/field';
import { isRetryable } from '@/domain/errors';
import type { Correction, NormalizedRecord } from '@/domain/document';
import { appendDocuments, buildColumnStore, type ColumnStore } from './corpus/columnStore';
import { DEFAULT_ARCHIVE_SIZE, DEFAULT_SEED } from './corpus/config';
import { detailAt, errorCodeAt, statusAt } from './corpus/documentAt';
import { applyPatch, createOverlay, readPatch, type Overlay } from './corpus/overlay';
import { advanceBatch, createBatch, requeue, type Batch } from './simulator/batch';
import { DEFAULT_SIMULATOR_CONFIG, type SimulatorConfig } from './simulator/config';

/** Room for uploaded documents on top of the existing archive. */
const UPLOAD_HEADROOM = 25_000;

/** Artificial latency, so loading states are real without the demo dragging. */
export type Latency = { read: number; write: number };

export const DEMO_LATENCY: Latency = { read: 180, write: 320 };

export type Database = {
  store: ColumnStore;
  overlay: Overlay;
  batches: Map<string, Batch>;
  config: SimulatorConfig;
  latency: Latency;
  seed: number;
  nextBatchNumber: number;
  /** Documents already in the reprocessing batch, so a retry never adds one twice. */
  reprocessMembers: Set<number>;
};

export type DatabaseOptions = {
  size?: number;
  config?: Partial<SimulatorConfig>;
  latency?: Latency;
};

function build({ size = DEFAULT_ARCHIVE_SIZE, config, latency }: DatabaseOptions): Database {
  return {
    store: buildColumnStore(DEFAULT_SEED, size, UPLOAD_HEADROOM),
    overlay: createOverlay(),
    batches: new Map(),
    config: { ...DEFAULT_SIMULATOR_CONFIG, ...config },
    latency: latency ?? DEMO_LATENCY,
    seed: DEFAULT_SEED,
    nextBatchNumber: 1,
    reprocessMembers: new Set(),
  };
}

let database: Database | null = null;

// Builds the archive once per process.
export function getDatabase(): Database {
  database ??= build({});
  return database;
}

// Rebuilds the archive from scratch. Tests use this to shrink it and drop latency.
export function resetDatabase(options: DatabaseOptions = {}): Database {
  database = build(options);
  return database;
}

/**
 * Brings every unsettled batch up to `now`.
 *
 * The simulation advances when it is observed rather than on a background
 * timer. That keeps it deterministic, avoids a timer running in a backgrounded
 * tab, and means the state a client reads is always current as of its request.
 */
export function advanceAll(db: Database, now = Date.now()): void {
  for (const batch of db.batches.values()) {
    if (batch.settledAt !== null) continue;
    advanceBatch(db.overlay, batch, db.seed, now, db.config);
  }
}

// Creates a batch of newly uploaded documents.
export function startBatch(
  db: Database,
  label: string,
  fileCount: number,
  now = Date.now(),
): Batch {
  const indices = appendDocuments(db.store, fileCount);
  const id = `batch-${db.nextBatchNumber}`;

  db.nextBatchNumber += 1;

  const batch = createBatch(db.overlay, id, label, indices, now);
  db.batches.set(id, batch);

  return batch;
}

export type RetrySelection = {
  retryable: number[];
  skipped: number;
};

/**
 * Splits a set of failed documents into those a retry could help and those it
 * cannot, so the caller can report the skipped ones instead of pretending.
 */
/**
 * Splits documents into the failures a retry could clear and the rest.
 *
 * One pass over status and cause, read straight from the columns and the
 * overlay. It used to build a full record per document, twice over for a
 * batch — once to find its failures and once more to partition them.
 */
export function selectRetryable(db: Database, indices: ArrayLike<number>): RetrySelection {
  const retryable: number[] = [];
  let skipped = 0;

  for (let position = 0; position < indices.length; position += 1) {
    const index = indices[position] as number;
    const code =
      statusAt(db.store, db.overlay, index) === 'failed'
        ? errorCodeAt(db.store, db.overlay, index)
        : undefined;

    if (code !== undefined && isRetryable(code)) retryable.push(index);
    else skipped += 1;
  }

  return { retryable, skipped };
}

// Collects the failed documents belonging to a batch.
export function failedIn(db: Database, batch: Batch): number[] {
  const failed: number[] = [];

  for (const index of batch.indices) {
    if (statusAt(db.store, db.overlay, index) === 'failed') failed.push(index);
  }

  return failed;
}

// A document's batch, if it has one, has a split to recount.
function invalidateBatchSummary(db: Database, index: number): void {
  const batchId = readPatch(db.overlay, index)?.batchId;
  const batch = batchId === undefined ? undefined : db.batches.get(batchId);
  if (batch !== undefined) batch.summary = null;
}

// Queues documents for another attempt and returns how many were requeued.
export function retryDocuments(db: Database, batch: Batch, indices: readonly number[]): number {
  return requeue(batch, db.overlay, indices);
}

export type ManualEntrySelection = {
  moved: number;
  /** Failures a retry could still clear, left alone rather than taken by hand. */
  skipped: number;
};

/**
 * Hands failures a retry cannot fix to an operator.
 *
 * The error code is kept. The document is no longer a processing failure, but
 * why it has to be entered by hand is still the most useful thing to know about
 * it, and discarding that would leave an unexplained review task.
 */
export function sendToManualEntry(db: Database, indices: readonly number[]): ManualEntrySelection {
  let moved = 0;
  let skipped = 0;

  for (const index of indices) {
    const code =
      statusAt(db.store, db.overlay, index) === 'failed'
        ? errorCodeAt(db.store, db.overlay, index)
        : undefined;

    // A retryable failure has a cheaper route out than an operator's time.
    if (code === undefined || isRetryable(code)) {
      skipped += 1;
      continue;
    }

    applyPatch(db.overlay, index, { status: 'needs_review' });
    invalidateBatchSummary(db, index);
    moved += 1;
  }

  return { moved, skipped };
}

/** Owns documents reprocessed outside of any upload. */
const REPROCESS_BATCH_ID = 'batch-reprocessing';

function ensureReprocessBatch(db: Database, now: number): Batch {
  const existing = db.batches.get(REPROCESS_BATCH_ID);
  if (existing !== undefined) return existing;

  const batch = createBatch(
    db.overlay,
    REPROCESS_BATCH_ID,
    'Reprocessing',
    new Uint32Array(0),
    now,
  );
  db.batches.set(REPROCESS_BATCH_ID, batch);

  return batch;
}

/**
 * Queues documents that belong to no upload for another attempt.
 *
 * The archive's own failures predate every batch in the session, so there is
 * nothing to requeue them into and a retry would have had nowhere to go. They
 * join one reprocessing batch instead, which also gives the work somewhere to
 * be watched rather than happening invisibly.
 */
export function reprocess(db: Database, indices: readonly number[], now = Date.now()): number {
  if (indices.length === 0) return 0;

  const batch = ensureReprocessBatch(db, now);
  const fresh = indices.filter((index) => !db.reprocessMembers.has(index));

  if (fresh.length > 0) {
    const merged = new Uint32Array(batch.indices.length + fresh.length);
    merged.set(batch.indices, 0);
    merged.set(Uint32Array.from(fresh), batch.indices.length);
    batch.indices = merged;
    for (const index of fresh) db.reprocessMembers.add(index);
    batch.summary = null;
  }

  for (const index of indices) applyPatch(db.overlay, index, { batchId: batch.id });

  return requeue(batch, db.overlay, indices);
}

// Finds the batch a document belongs to, if any.
export function batchFor(db: Database, index: number): Batch | undefined {
  const batchId = detailAt(db.store, db.overlay, index).batchId;
  return batchId === undefined ? undefined : db.batches.get(batchId);
}

/**
 * Records an operator's correction to one field.
 *
 * The corrected value is trusted absolutely, and the previous value is kept so
 * the audit trail can show what was changed rather than only that it was.
 */
export function correctDocument(
  db: Database,
  index: number,
  field: keyof NormalizedRecord,
  value: string,
  now = Date.now(),
): void {
  const detail = detailAt(db.store, db.overlay, index);
  const previous = detail.fields[field];
  const corrected = correctField(previous as ExtractedField<string>, value);

  const entry: Correction = {
    field,
    next: value,
    correctedAt: now,
    ...(previous.value === undefined ? {} : { previous: previous.value }),
  };

  applyPatch(db.overlay, index, {
    fields: { [field]: corrected } as Partial<NormalizedRecord>,
    corrections: [entry],
  });

  // A document with nothing left to check is no longer a review task.
  const updated = detailAt(db.store, db.overlay, index);
  const stillUncertain = Object.values(updated.fields).some(
    (candidate) => candidate.source !== 'manual' && candidate.confidence < 0.7,
  );

  if (updated.status === 'needs_review' && !stillUncertain) {
    applyPatch(db.overlay, index, { status: 'completed' });
    invalidateBatchSummary(db, index);
  }
}
