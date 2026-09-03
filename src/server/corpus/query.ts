import { confidenceBand, type ConfidenceBand } from '@/domain/confidence';
import { DOCUMENT_TYPES, type DocumentSummary, type DocumentType } from '@/domain/document';
import type { ProcessingErrorCode } from '@/domain/errors';
import { PROCESSING_STATUSES, type ProcessingStatus } from '@/domain/status';
import type { ColumnStore } from './columnStore';
import { errorFromId, summaryAt } from './documentAt';
import type { Overlay } from './overlay';
import { isSearchable, resolveSearch } from './searchIndex';

export const SORT_FIELDS = [
  'uploadedAt',
  'confidence',
  'personName',
  'status',
  'documentType',
  'index',
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export type DocumentQuery = {
  status?: readonly ProcessingStatus[];
  documentType?: readonly DocumentType[];
  confidence?: readonly ConfidenceBand[];
  search?: string;
  /** Restricts to documents an operator has to act on. */
  needsAttention?: boolean;
  /** Restricts to one upload, so a batch can link into its own failures. */
  batchId?: string;
  /** Restricts to failures of a given cause, so a breakdown can be opened. */
  errorCode?: readonly ProcessingErrorCode[];
  sortField?: SortField;
  sortDirection?: SortDirection;
  page?: number;
  pageSize?: number;
};

export type QueryResult = {
  rows: DocumentSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// Turns the requested statuses into a lookup keyed by the id stored in a column.
function statusMask(statuses: readonly ProcessingStatus[] | undefined): Uint8Array | null {
  if (!statuses || statuses.length === 0) return null;

  const mask = new Uint8Array(PROCESSING_STATUSES.length);
  for (const status of statuses) {
    const id = PROCESSING_STATUSES.indexOf(status);
    if (id >= 0) mask[id] = 1;
  }

  return mask;
}

function typeMask(types: readonly DocumentType[] | undefined): Uint8Array | null {
  if (!types || types.length === 0) return null;

  const mask = new Uint8Array(DOCUMENT_TYPES.length);
  for (const type of types) {
    const id = DOCUMENT_TYPES.indexOf(type);
    if (id >= 0) mask[id] = 1;
  }

  return mask;
}

/**
 * Walks the archive once and collects matching row indices.
 *
 * Filtering reads the typed-array columns directly and writes integers into a
 * Uint32Array, so a full pass over 100,000 documents never allocates a record.
 * Rows are only turned into objects once the page is known.
 */
export function filterIndices(
  store: ColumnStore,
  overlay: Overlay,
  query: DocumentQuery,
): Uint32Array {
  const statuses = statusMask(query.status);
  const types = typeMask(query.documentType);
  const bands = query.confidence && query.confidence.length > 0 ? new Set(query.confidence) : null;
  const search = isSearchable(query.search) ? resolveSearch(query.search) : null;
  const causes = query.errorCode && query.errorCode.length > 0 ? new Set(query.errorCode) : null;
  const hasOverlay = overlay.size > 0;

  // Only uploaded documents carry a batch id, so a batch filter can never match
  // anything in the generated archive.
  if (query.batchId !== undefined && !hasOverlay) return new Uint32Array(0);

  const matched = new Uint32Array(store.size);
  let count = 0;

  for (let index = 0; index < store.size; index += 1) {
    const patch = hasOverlay ? overlay.get(index) : undefined;
    const statusId = patch?.status
      ? PROCESSING_STATUSES.indexOf(patch.status)
      : (store.statusId[index] as number);

    if (query.batchId !== undefined && patch?.batchId !== query.batchId) continue;
    if (statuses && statuses[statusId] !== 1) continue;
    if (types && types[store.docTypeId[index] as number] !== 1) continue;

    if (query.needsAttention === true) {
      const status = PROCESSING_STATUSES[statusId] as ProcessingStatus;
      if (status !== 'failed' && status !== 'needs_review') continue;
    }

    if (causes) {
      // Read the same way `summaryAt` reads it: a patch may have cleared the
      // generated error, and a retried document must not still match its old cause.
      const code =
        patch?.errorCode === null
          ? undefined
          : (patch?.errorCode ?? errorFromId(store.errorId[index] as number));

      if (code === undefined || !causes.has(code)) continue;
    }

    if (bands && !bands.has(confidenceBand(store.confidence[index] as number))) continue;

    if (search) {
      const matchesName = search.nameIds.has(store.nameId[index] as number);
      const matchesLocation = search.locationIds.has(store.locationId[index] as number);
      const matchesId = search.documentIndex === index;

      if (!matchesName && !matchesLocation && !matchesId) continue;
    }

    matched[count] = index;
    count += 1;
  }

  return matched.subarray(0, count);
}

// Reads the value a sort compares, straight from the columns.
function sortValue(store: ColumnStore, index: number, field: SortField): number {
  switch (field) {
    case 'uploadedAt':
      return store.uploadedAt[index] as number;
    case 'confidence':
      return store.confidence[index] as number;
    case 'personName':
      return store.nameId[index] as number;
    case 'status':
      return store.statusId[index] as number;
    case 'documentType':
      return store.docTypeId[index] as number;
    case 'index':
      return index;
  }
}

/**
 * Orders matching rows in place. The index is the final tie-break so equal keys
 * never reorder between requests, which would make pagination skip or repeat
 * rows as an operator pages through.
 */
export function sortIndices(
  store: ColumnStore,
  indices: Uint32Array,
  field: SortField,
  direction: SortDirection,
): Uint32Array {
  const sign = direction === 'desc' ? -1 : 1;

  // Sorting a copy keeps the caller's array, and subarray views, untouched.
  const ordered = Uint32Array.from(indices);

  ordered.sort((a, b) => {
    const left = sortValue(store, a, field);
    const right = sortValue(store, b, field);

    if (left < right) return -sign;
    if (left > right) return sign;
    return a - b;
  });

  return ordered;
}

// Clamps a requested page size into something a grid can actually render.
function normalizePageSize(pageSize: number | undefined): number {
  if (pageSize === undefined) return DEFAULT_PAGE_SIZE;

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError(`Page size must be a positive integer, received ${pageSize}`);
  }

  return Math.min(pageSize, MAX_PAGE_SIZE);
}

function normalizePage(page: number | undefined): number {
  if (page === undefined) return 0;

  if (!Number.isInteger(page) || page < 0) {
    throw new RangeError(`Page must be a non-negative integer, received ${page}`);
  }

  return page;
}

/**
 * Answers a grid query. Filtering and sorting work on integer indices; only the
 * requested page is materialized into records, so the cost of a page is the page
 * size rather than the archive size.
 */
export function queryDocuments(
  store: ColumnStore,
  overlay: Overlay,
  query: DocumentQuery = {},
): QueryResult {
  const pageSize = normalizePageSize(query.pageSize);
  const page = normalizePage(query.page);

  const matched = filterIndices(store, overlay, query);
  const ordered = sortIndices(
    store,
    matched,
    query.sortField ?? 'uploadedAt',
    query.sortDirection ?? 'desc',
  );

  const total = ordered.length;
  const pageCount = Math.ceil(total / pageSize);
  const start = page * pageSize;
  const rows: DocumentSummary[] = [];

  for (let offset = start; offset < Math.min(start + pageSize, total); offset += 1) {
    rows.push(summaryAt(store, overlay, ordered[offset] as number));
  }

  return { rows, total, page, pageSize, pageCount };
}

/** Counts matches per status, for the overview tiles and filter chips. */
export function countByStatus(
  store: ColumnStore,
  overlay: Overlay,
): Record<ProcessingStatus, number> {
  const counts = Object.fromEntries(PROCESSING_STATUSES.map((status) => [status, 0])) as Record<
    ProcessingStatus,
    number
  >;
  const hasOverlay = overlay.size > 0;

  for (let index = 0; index < store.size; index += 1) {
    const patch = hasOverlay ? overlay.get(index) : undefined;
    const status =
      patch?.status ?? (PROCESSING_STATUSES[store.statusId[index] as number] as ProcessingStatus);

    counts[status] += 1;
  }

  return counts;
}
