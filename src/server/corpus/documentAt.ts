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
import { readPatch, type Overlay } from './overlay';
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

function errorFromId(errorId: number): ProcessingErrorCode | undefined {
  if (errorId === 0) return undefined;
  return PROCESSING_ERROR_CODES[errorId - 1];
}

// Formats a document date from the upload time, one day earlier than filing.
function documentDate(uploadedAt: number): string {
  return new Date(uploadedAt - 86_400_000).toISOString().slice(0, 10);
}

function phoneFor(nameId: number, locationId: number): string {
  const body = String((nameId * 7919 + locationId * 104729) % 100_000_000).padStart(8, '0');
  return `+8801${body}`;
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

/** Reads the grid row for a document, with any recorded changes applied. */
export function summaryAt(store: ColumnStore, overlay: Overlay, index: number): DocumentSummary {
  assertInRange(store, index);

  const patch = readPatch(overlay, index);
  const status =
    patch?.status ?? (PROCESSING_STATUSES[store.statusId[index] as number] as ProcessingStatus);
  const docTypeId = store.docTypeId[index] as number;
  const pageCount = store.pageCount[index] as number;
  const hasValues = status === 'completed' || status === 'needs_review';

  const errorCode =
    patch?.errorCode === null
      ? undefined
      : (patch?.errorCode ?? errorFromId(store.errorId[index] as number));

  return {
    id: documentId(index),
    index,
    fileName: fileName(index, docTypeId, pageCount),
    documentType: DOCUMENT_TYPES[docTypeId] as (typeof DOCUMENT_TYPES)[number],
    status,
    confidence: store.confidence[index] as number,
    uploadedAt: store.uploadedAt[index] as number,
    personName: hasValues ? (NAME_POOL[store.nameId[index] as number] as string) : undefined,
    location: hasValues ? (LOCATION_POOL[store.locationId[index] as number] as string) : undefined,
    errorCode: status === 'failed' ? errorCode : undefined,
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
