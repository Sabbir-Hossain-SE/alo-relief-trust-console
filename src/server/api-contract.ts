import { z } from 'zod';
import { CONFIDENCE_BANDS } from '@/domain/confidence';
import { DOCUMENT_TYPES } from '@/domain/document';
import { PROCESSING_ERROR_CODES } from '@/domain/errors';
import { PROCESSING_STATUSES } from '@/domain/status';
import { SORT_FIELDS } from '@/domain/sort';

/**
 * The wire contract, shared by the handlers and the client so the two cannot
 * drift. Parsed rather than cast: query strings arrive as text, and a grid that
 * puts its state in the URL will eventually be handed something malformed.
 */

export const API_BASE = '/api';

/**
 * Resolves an API path to an absolute URL.
 *
 * Always absolute. Node's fetch rejects a relative URL outright, and jsdom
 * leaves the global fetch in place, so a relative path works in the browser and
 * fails in tests. Resolving against the current origin keeps requests
 * same-origin for the service worker and valid for Node.
 */
export function apiUrl(path = ''): string {
  const origin = typeof location === 'undefined' ? 'http://localhost' : location.origin;
  return `${origin}${API_BASE}${path}`;
}

const statusSchema = z.enum(PROCESSING_STATUSES);
const documentTypeSchema = z.enum(DOCUMENT_TYPES);
const confidenceBandSchema = z.enum(CONFIDENCE_BANDS);
const errorCodeSchema = z.enum(PROCESSING_ERROR_CODES);

export const documentQuerySchema = z.object({
  status: z.array(statusSchema).optional(),
  documentType: z.array(documentTypeSchema).optional(),
  confidence: z.array(confidenceBandSchema).optional(),
  search: z.string().optional(),
  needsAttention: z.boolean().optional(),
  batchId: z.string().min(1).max(64).optional(),
  errorCode: z.array(errorCodeSchema).optional(),
  sortField: z.enum(SORT_FIELDS).optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().min(0).optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
});

export type DocumentQueryInput = z.infer<typeof documentQuerySchema>;

/** As long as a batch label may be. Shared with the upload, which cuts folder names to fit. */
export const BATCH_LABEL_MAX_LENGTH = 120;

export const createBatchSchema = z.object({
  label: z.string().min(1).max(BATCH_LABEL_MAX_LENGTH),
  /** How many documents the upload contained. */
  fileCount: z.number().int().min(1).max(50_000),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;

export const uploadFileSchema = z.object({
  name: z.string().min(1).max(400),
  size: z.number().int().min(1),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;

/**
 * The correction schemas live in their own module: they carry the phone
 * validator and its numbering plans, which only the handlers and the correction
 * form need, and importing them here put that on every route.
 */
export type { CorrectionInput, CorrectionsInput } from './correction-contract';

export const retryBatchSchema = z.object({
  /** Restricts the retry to these documents; omitted means every retryable failure. */
  indices: z.array(z.number().int().min(0)).optional(),
});

export type RetryBatchInput = z.infer<typeof retryBatchSchema>;

export type ApiError = {
  code: 'not_found' | 'invalid_request' | 'not_retryable' | 'server_error';
  message: string;
  /** What the operator can do about it, when there is something. */
  remedy?: string;
};

export type ArchiveSummary = {
  total: number;
  byStatus: Record<(typeof PROCESSING_STATUSES)[number], number>;
};

export type { ArchiveAnalytics } from './corpus/analytics';

export type ManualEntryResult = {
  moved: number;
  /** Failures left alone because a retry could still clear them. */
  skipped: number;
};

export type RetryResult = {
  retried: number;
  /** Failures a retry cannot fix, so the interface can say so rather than silently dropping them. */
  skipped: number;
};

// Serializes a query into the search params the documents endpoint expects.
export function toSearchParams(query: DocumentQueryInput): URLSearchParams {
  const params = new URLSearchParams();

  for (const value of query.status ?? []) params.append('status', value);
  for (const value of query.documentType ?? []) params.append('type', value);
  for (const value of query.confidence ?? []) params.append('confidence', value);

  if (query.search) params.set('q', query.search);
  if (query.needsAttention) params.set('attention', '1');
  if (query.batchId) params.set('batch', query.batchId);
  for (const value of query.errorCode ?? []) params.append('cause', value);
  if (query.sortField) params.set('sort', query.sortField);
  if (query.sortDirection) params.set('dir', query.sortDirection);
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));

  return params;
}

// Keeps the members of a repeated parameter the schema accepts, one by one.
function accepted<T>(values: readonly string[], schema: z.ZodType<T>): T[] | undefined {
  const kept = values.flatMap((value) => {
    const parsed = schema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });

  return kept.length > 0 ? kept : undefined;
}

/**
 * Parses search params back into a query.
 *
 * Field by field rather than as one object. A URL is shared, bookmarked and
 * hand-edited, and a link saved before a status was renamed carries one value
 * the schema no longer knows beside four it still does. Failing the object
 * threw all five away and showed the whole archive under a filter bar that said
 * nothing was applied; dropping only the value it cannot read keeps the view
 * the link was made to share.
 */
export function fromSearchParams(params: URLSearchParams): DocumentQueryInput {
  const numeric = (key: string): number | undefined => {
    const raw = params.get(key);
    if (raw === null) return undefined;

    const value = Number(raw);
    return Number.isInteger(value) ? value : undefined;
  };

  const candidate: Record<keyof DocumentQueryInput, unknown> = {
    status: accepted(params.getAll('status'), statusSchema),
    documentType: accepted(params.getAll('type'), documentTypeSchema),
    confidence: accepted(params.getAll('confidence'), confidenceBandSchema),
    search: params.get('q') ?? undefined,
    needsAttention: params.get('attention') === '1' ? true : undefined,
    batchId: params.get('batch') ?? undefined,
    errorCode: accepted(params.getAll('cause'), errorCodeSchema),
    sortField: params.get('sort') ?? undefined,
    sortDirection: params.get('dir') ?? undefined,
    page: numeric('page'),
    pageSize: numeric('pageSize'),
  };

  const query: Record<string, unknown> = {};

  for (const key of Object.keys(documentQuerySchema.shape) as (keyof DocumentQueryInput)[]) {
    const parsed = (documentQuerySchema.shape[key] as z.ZodType).safeParse(candidate[key]);
    if (parsed.success && parsed.data !== undefined) query[key] = parsed.data;
  }

  // A direction means nothing without a field. Kept on its own it turned the
  // default sort the other way round while the header arrow said otherwise.
  if (query.sortField === undefined) delete query.sortDirection;

  return query as DocumentQueryInput;
}
