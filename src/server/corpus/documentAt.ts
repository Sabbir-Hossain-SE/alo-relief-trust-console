import {
  DOCUMENT_TYPES,
  NORMALIZED_FIELD_KEYS,
  type DocumentDetail,
  type DocumentSummary,
  type NormalizedRecord,
} from '@/domain/document';
import { PROCESSING_ERROR_CODES, type ProcessingErrorCode } from '@/domain/errors';
import { PROCESSING_STATUSES, type ProcessingStatus } from '@/domain/status';
import type { ExtractedField } from '@/domain/field';
import { assertInRange, type ColumnStore } from './columnStore';
import { generateCore, FIELD_COUNT } from './generate';
import { readPatch, type DocumentPatch, type Overlay } from './overlay';
import { LOCATION_POOL, NAME_POOL, PROGRAM_POOL } from './pools.generated';

const FILE_EXTENSIONS = ['pdf', 'jpg', 'png', 'tiff'] as const;

// Stable public identifier for a document at a given index.
export function documentId(index: number): string {
  return `ARC-${String(index).padStart(6, '0')}`;
}

// Reverses documentId, returning null when the identifier is not one of ours.
export function indexFromId(id: string): number | null {
  const match = /^ARC-(\d{6,})$/.exec(id);
  if (!match) return null;

  const index = Number(match[1]);
  return Number.isSafeInteger(index) ? index : null;
}

function fileName(index: number, docTypeId: number, pageCount: number): string {
  const type = DOCUMENT_TYPES[docTypeId] as string;
  const extension = FILE_EXTENSIONS[(index + pageCount) % FILE_EXTENSIONS.length] as string;
  return `${type}-${String(index).padStart(6, '0')}.${extension}`;
}

export function errorFromId(errorId: number): ProcessingErrorCode | undefined {
  if (errorId === 0) return undefined;
  return PROCESSING_ERROR_CODES[errorId - 1];
}

// Formats a document date from the upload time, one day earlier than filing.
function documentDate(uploadedAt: number): string {
  return new Date(uploadedAt - 86_400_000).toISOString().slice(0, 10);
}

/**
 * A Bangladeshi mobile number, in the shape the numbering plan actually issues.
 *
 * The operator prefix is part of that shape: 01[3-9] is what the regulator has
 * allocated, so `+8801` followed by any eight digits is a number no network
 * would route. It went unnoticed while nothing checked, and every record in the
 * archive would now fail the correction form's validator.
 */
const OPERATOR_PREFIXES = 7;

function phoneFor(nameId: number, locationId: number): string {
  const operator = 3 + ((nameId + locationId) % OPERATOR_PREFIXES);
  const body = String((nameId * 7919 + locationId * 104729) % 100_000_000).padStart(8, '0');
  return `+8801${operator}${body}`;
}

/**
 * Builds the normalized record for one document. Values come from the pools and
 * confidences from the same seeded stream that filled the column store, so the
 * detail view always agrees with the row the operator clicked.
 */
function buildFields(index: number, seed: number, status: ProcessingStatus): NormalizedRecord {
  const core = generateCore(seed, index);
  const values: Record<(typeof NORMALIZED_FIELD_KEYS)[number], string> = {
    personName: NAME_POOL[core.nameId] as string,
    phone: phoneFor(core.nameId, core.locationId),
    location: LOCATION_POOL[core.locationId] as string,
    programName: PROGRAM_POOL[core.programId] as string,
    documentDate: documentDate(core.uploadedAt),
  };

  const record = {} as NormalizedRecord;

  for (let i = 0; i < FIELD_COUNT; i += 1) {
    const key = NORMALIZED_FIELD_KEYS[i] as (typeof NORMALIZED_FIELD_KEYS)[number];
    const missing = (core.missingMask & (1 << i)) !== 0;
    const extracted: ExtractedField<string> = {
      confidence: core.fieldConfidence[i] as number,
      source: status === 'needs_review' ? 'ml' : 'ocr',
    };

    if (!missing) extracted.value = values[key];
    record[key] = extracted;
  }

  return record;
}

/**
 * Prefers an operator's correction over the generated value.
 *
 * The presence of the field in the patch is what decides, not its value: an
 * operator who clears a field is asserting the page holds nothing there, which
 * is a different statement from never having corrected it. Falling back on a
 * truthy check would quietly restore the pipeline's guess.
 */
function corrected(
  patch: DocumentPatch | undefined,
  key: 'personName' | 'location',
  generated: string,
): string | undefined {
  const field = patch?.fields?.[key];
  return field === undefined ? generated : field.value;
}

/** Reads the grid row for a document, with any recorded changes applied. */
/** A document's status, the overlay's word over the column's. */
export function statusAt(store: ColumnStore, overlay: Overlay, index: number): ProcessingStatus {
  return (
    readPatch(overlay, index)?.status ??
    (PROCESSING_STATUSES[store.statusId[index] as number] as ProcessingStatus)
  );
}

/**
 * A document's failure code, if it has one.
 *
 * A patch may have cleared the generated error, so a retried document must not
 * still report its old cause.
 */
export function errorCodeAt(
  store: ColumnStore,
  overlay: Overlay,
  index: number,
): ProcessingErrorCode | undefined {
  const patch = readPatch(overlay, index);
  return patch?.errorCode === null
    ? undefined
    : (patch?.errorCode ?? errorFromId(store.errorId[index] as number));
}

export function summaryAt(store: ColumnStore, overlay: Overlay, index: number): DocumentSummary {
  assertInRange(store, index);

  const patch = readPatch(overlay, index);
  const status = statusAt(store, overlay, index);
  const docTypeId = store.docTypeId[index] as number;
  const pageCount = store.pageCount[index] as number;
  const hasValues = status === 'completed' || status === 'needs_review';
  const errorCode = errorCodeAt(store, overlay, index);

  return {
    id: documentId(index),
    index,
    fileName: fileName(index, docTypeId, pageCount),
    documentType: DOCUMENT_TYPES[docTypeId] as (typeof DOCUMENT_TYPES)[number],
    status,
    confidence: store.confidence[index] as number,
    uploadedAt: store.uploadedAt[index] as number,
    // Corrections have to reach the row, not only the drawer: the grid, the
    // review queue and the CSV export all read a summary, and a record that
    // reads one way when open and another when closed is not one record.
    personName: hasValues
      ? corrected(patch, 'personName', NAME_POOL[store.nameId[index] as number] as string)
      : undefined,
    location: hasValues
      ? corrected(patch, 'location', LOCATION_POOL[store.locationId[index] as number] as string)
      : undefined,
    // Also carried on a review task, because a failure handed to an operator
    // keeps the reason it could not be extracted. Safe for generated rows: only
    // a failed document is given an error id, and the simulator clears it on
    // every other outcome, so an ordinary review task still reports none.
    errorCode: status === 'failed' || status === 'needs_review' ? errorCode : undefined,
    attempts: patch?.attempts ?? (store.attempts[index] as number),
  };
}

/** Reads the full record for a document. Called for one row at a time. */
export function detailAt(store: ColumnStore, overlay: Overlay, index: number): DocumentDetail {
  const summary = summaryAt(store, overlay, index);
  const patch = readPatch(overlay, index);
  const generated = buildFields(index, store.seed, summary.status);

  return {
    ...summary,
    sizeBytes: store.sizeBytes[index] as number,
    pageCount: store.pageCount[index] as number,
    batchId: patch?.batchId,
    processedAt: patch?.processedAt,
    fields: { ...generated, ...patch?.fields },
    corrections: patch?.corrections ?? [],
  };
}
