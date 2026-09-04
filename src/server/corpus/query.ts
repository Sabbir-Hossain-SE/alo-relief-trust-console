import { HIGH_CONFIDENCE, MEDIUM_CONFIDENCE, type ConfidenceBand } from '@/domain/confidence';
import { DOCUMENT_TYPES, type DocumentSummary, type DocumentType } from '@/domain/document';
import type { ProcessingErrorCode } from '@/domain/errors';
import { DEFAULT_PAGE_SIZE } from '@/domain/pagination';
import { SORT_FIELDS, type SortDirection, type SortField } from '@/domain/sort';
import {
  PROCESSING_STATUSES,
  isExtracted,
  needsAttention,
  type ProcessingStatus,
} from '@/domain/status';
import type { ColumnStore } from './columnStore';
import { errorFromId, summaryAt } from './documentAt';
import type { Overlay } from './overlay';
import { isSearchable, resolveSearch, type SearchTargets } from './searchIndex';
import { sortIndices } from './sort';

export { SORT_FIELDS, sortIndices, type SortDirection, type SortField };

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

export { DEFAULT_PAGE_SIZE };
const MAX_PAGE_SIZE = 200;

/**
 * Lookups keyed by status id, built once from the domain's own tables.
 *
 * The row loop runs a hundred thousand times per request; naming a status,
 * asking the domain about it and comparing strings on every row cost more
 * than the filter it was answering for.
 */
const STATUS_ID = Object.fromEntries(
  PROCESSING_STATUSES.map((status, id) => [status, id]),
) as Record<ProcessingStatus, number>;
const EXTRACTED_BY_STATUS = Uint8Array.from(PROCESSING_STATUSES, (s) => (isExtracted(s) ? 1 : 0));
const ATTENTION_BY_STATUS = Uint8Array.from(PROCESSING_STATUSES, (s) =>
  needsAttention(s) ? 1 : 0,
);

/** A band as the row loop ranks it: low 0, medium 1, high 2. */
const BAND_RANK: Record<ConfidenceBand, number> = { low: 0, medium: 1, high: 2 };

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

function bandMask(bands: readonly ConfidenceBand[] | undefined): Uint8Array | null {
  if (!bands || bands.length === 0) return null;

  const mask = new Uint8Array(3);
  for (const band of bands) mask[BAND_RANK[band]] = 1;

  return mask;
}

// A term that resolved to no name, no location and no id cannot match a row.
function matchesNothing(search: SearchTargets): boolean {
  return (
    search.nameIds.size === 0 && search.locationIds.size === 0 && search.documentIndex === null
  );
}

/**
 * Walks the archive once and collects matching row indices.
 *
 * Filtering reads the typed-array columns directly and writes integers into a
 * Uint32Array, so a full pass over 100,000 documents never allocates a record.
 * Rows are only turned into objects once the page is known.
 *
 * Walked in `order` when one is given, so the result comes out already in it —
 * the newest-first order the grid opens in is kept on the store for exactly
 * this, and used to be re-sorted from scratch on every request.
 */
function collect(
  store: ColumnStore,
  overlay: Overlay,
  query: DocumentQuery,
  order: Uint32Array | null,
): Uint32Array {
  const statuses = statusMask(query.status);
  const types = typeMask(query.documentType);
  const bands = bandMask(query.confidence);
  const search = isSearchable(query.search) ? resolveSearch(query.search) : null;
  const causes = query.errorCode && query.errorCode.length > 0 ? new Set(query.errorCode) : null;
  const hasOverlay = overlay.size > 0;

  // Only uploaded documents carry a batch id, so a batch filter can never match
  // anything in the generated archive.
  if (query.batchId !== undefined && !hasOverlay) return new Uint32Array(0);
  if (search !== null && matchesNothing(search)) return new Uint32Array(0);

  const matchNames = search !== null && search.nameIds.size > 0;
  const matchLocations = search !== null && search.locationIds.size > 0;
  const total = order === null ? store.size : order.length;
  const matched = new Uint32Array(total);
  let count = 0;

  for (let position = 0; position < total; position += 1) {
    const index = order === null ? position : (order[position] as number);
    const patch = hasOverlay ? overlay.get(index) : undefined;
    const statusId = patch?.status ? STATUS_ID[patch.status] : (store.statusId[index] as number);

    if (query.batchId !== undefined && patch?.batchId !== query.batchId) continue;
    if (statuses && statuses[statusId] !== 1) continue;
    if (types && types[store.docTypeId[index] as number] !== 1) continue;
    if (query.needsAttention === true && ATTENTION_BY_STATUS[statusId] !== 1) continue;

    if (causes) {
      // Read the same way `summaryAt` reads it: a patch may have cleared the
      // generated error, and a retried document must not still match its old cause.
      const code =
        patch?.errorCode === null
          ? undefined
          : (patch?.errorCode ?? errorFromId(store.errorId[index] as number));

      if (code === undefined || !causes.has(code)) continue;
    }

    if (bands) {
      // A confidence belongs to an extraction. A document the pipeline has not
      // read is stored at zero, which would put every pending and failed one
      // in the low band and swell it to several times the figure the overview
      // reports for the same word.
      if (EXTRACTED_BY_STATUS[statusId] !== 1) continue;

      const score = store.confidence[index] as number;
      const rank = score >= HIGH_CONFIDENCE ? 2 : score >= MEDIUM_CONFIDENCE ? 1 : 0;
      if (bands[rank] !== 1) continue;
    }

    if (search) {
      const matchesName = matchNames && search.nameIds.has(store.nameId[index] as number);
      const matchesLocation =
        matchLocations && search.locationIds.has(store.locationId[index] as number);
      const matchesId = search.documentIndex === index;

      if (!matchesName && !matchesLocation && !matchesId) continue;
    }

    matched[count] = index;
    count += 1;
  }

  return matched.subarray(0, count);
}

/** Matching row indices in archive order, ascending by index. */
export function filterIndices(
  store: ColumnStore,
  overlay: Overlay,
  query: DocumentQuery,
): Uint32Array {
  return collect(store, overlay, query, null);
}

// The kept order has to cover the archive exactly; a stale one would drop
// every row an upload appended from the default view without a word.
function uploadedOrder(store: ColumnStore): Uint32Array {
  if (store.uploadedDesc.length !== store.size) {
    throw new RangeError(
      `The upload order covers ${store.uploadedDesc.length} rows of an archive of ${store.size}`,
    );
  }

  return store.uploadedDesc;
}

/**
 * Matching row indices in the order the query asks for.
 *
 * The default order — newest upload first — is walked rather than sorted, so
 * the view the grid opens in costs a filter pass and nothing more. Any other
 * order is collected and then sorted.
 */
export function orderedIndices(
  store: ColumnStore,
  overlay: Overlay,
  query: DocumentQuery,
): Uint32Array {
  const field = query.sortField ?? 'uploadedAt';
  const direction = query.sortDirection ?? 'desc';

  if (field === 'uploadedAt' && direction === 'desc') {
    return collect(store, overlay, query, uploadedOrder(store));
  }

  return sortIndices(store, collect(store, overlay, query, null), field, direction);
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

  const ordered = orderedIndices(store, overlay, query);

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
