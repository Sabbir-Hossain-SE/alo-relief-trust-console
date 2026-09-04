import { confidenceBand } from '@/domain/confidence';
import { DOCUMENT_TYPE_LABELS, type DocumentSummary } from '@/domain/document';
import { describeError } from '@/domain/errors';
import { STATUS_LABELS } from '@/domain/status';
import { CSV_BOM, csvRow } from '@/lib/csv/serialize';
import type { ColumnStore } from './columnStore';
import { summaryAt } from './documentAt';
import type { Overlay } from './overlay';

export const DOCUMENT_CSV_COLUMNS = [
  'ID',
  'File name',
  'Type',
  'Status',
  'Confidence',
  'Confidence band',
  'Person name',
  'Location',
  'Uploaded',
  'Failure',
  'Attempts',
] as const;

/**
 * Whether extraction has produced a confidence worth reporting.
 *
 * A pending or failed document is stored at 0, which is honest for sorting and
 * a lie in a spreadsheet: 0% reads as "the pipeline read this and was certain
 * it was wrong" rather than "the pipeline never read it".
 */
function hasConfidence(row: DocumentSummary): boolean {
  return row.status === 'completed' || row.status === 'needs_review';
}

function rowFor(row: DocumentSummary): (string | number | undefined)[] {
  const extracted = hasConfidence(row);

  return [
    row.id,
    row.fileName,
    DOCUMENT_TYPE_LABELS[row.documentType],
    STATUS_LABELS[row.status],
    // A number, not "87%", so a spreadsheet can average and chart the column.
    extracted ? Number(row.confidence.toFixed(4)) : undefined,
    extracted ? confidenceBand(row.confidence) : undefined,
    row.personName,
    row.location,
    // ISO 8601 rather than the interface's "4 Sept 2026": a CSV is read by
    // whatever the recipient opens it in, and only this sorts and parses
    // the same way everywhere.
    new Date(row.uploadedAt).toISOString(),
    row.errorCode === undefined ? undefined : describeError(row.errorCode).title,
    row.attempts,
  ];
}

/** Materializes one row at a time, so the export never holds the archive twice. */
function* rows(
  store: ColumnStore,
  overlay: Overlay,
  indices: Uint32Array,
): Generator<(string | number | undefined)[]> {
  for (const index of indices) yield rowFor(summaryAt(store, overlay, index));
}

/** Rows per chunk: a few milliseconds of work each, a few dozen chunks for the archive. */
export const CSV_CHUNK_ROWS = 2000;

/**
 * Renders matching documents as CSV, a chunk of whole rows at a time.
 *
 * Built here rather than in the browser because the client would otherwise
 * have to page 100,000 rows out of an API that caps a page at 200 — five
 * hundred round trips to produce a file the backend can write in one pass.
 * Yielded in chunks so that pass can be streamed with a breath between them:
 * as one string it was a fifth of a second the page could not paint through.
 * The first chunk carries the byte order mark and the header.
 */
export function* csvChunks(
  store: ColumnStore,
  overlay: Overlay,
  indices: Uint32Array,
  rowsPerChunk = CSV_CHUNK_ROWS,
): Generator<string> {
  let chunk = CSV_BOM + csvRow(DOCUMENT_CSV_COLUMNS);
  let count = 0;

  for (const row of rows(store, overlay, indices)) {
    chunk += csvRow(row);
    count += 1;

    if (count === rowsPerChunk) {
      yield chunk;
      chunk = '';
      count = 0;
    }
  }

  if (chunk !== '') yield chunk;
}

/** The whole file as one string, for callers that want it in hand. */
export function documentsToCsv(store: ColumnStore, overlay: Overlay, indices: Uint32Array): string {
  return [...csvChunks(store, overlay, indices)].join('');
}

/** Names the file after what it holds, so a folder of exports is navigable. */
export function exportFileName(now = new Date()): string {
  return `alo-relief-trust-documents-${now.toISOString().slice(0, 10)}.csv`;
}
