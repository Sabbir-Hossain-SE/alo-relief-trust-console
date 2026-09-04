import { z } from 'zod';
import { DOCUMENT_TYPES, NORMALIZED_FIELD_KEYS } from '@/domain/document';
import { PROCESSING_ERROR_CODES } from '@/domain/errors';
import { PROCESSING_STATUSES } from '@/domain/status';
import { documentDateMessage } from '@/lib/date/isoDate';
import { phoneProblem } from '@/lib/phone/phone';
import { SORT_FIELDS } from './corpus/query';

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

export const documentQuerySchema = z.object({
  status: z.array(z.enum(PROCESSING_STATUSES)).optional(),
  documentType: z.array(z.enum(DOCUMENT_TYPES)).optional(),
  confidence: z.array(z.enum(['high', 'medium', 'low'])).optional(),
  search: z.string().optional(),
  needsAttention: z.boolean().optional(),
  batchId: z.string().min(1).max(64).optional(),
  errorCode: z.array(z.enum(PROCESSING_ERROR_CODES)).optional(),
  sortField: z.enum(SORT_FIELDS).optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().min(0).optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
});

export type DocumentQueryInput = z.infer<typeof documentQuerySchema>;

export const createBatchSchema = z.object({
  label: z.string().min(1).max(120),
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
 * A correction has to satisfy the same rules the form applies.
 *
 * The form is where an operator meets them, but a backend that accepts whatever
 * reaches it is not validating — it is trusting the client, and the archive
 * ends up holding numbers no network routes and days that never happened. Both
 * ends read the rule from `lib/`, so they cannot disagree.
 */
const FIELD_RULES: Partial<
  Record<(typeof NORMALIZED_FIELD_KEYS)[number], (value: string) => string | null>
> = {
  phone: phoneProblem,
  documentDate: (value) => documentDateMessage(value),
};

export const correctionSchema = z
  .object({
    field: z.enum(NORMALIZED_FIELD_KEYS),
    value: z.string().trim().max(200),
  })
  .superRefine(({ field, value }, ctx) => {
    const problem = FIELD_RULES[field]?.(value) ?? null;
    if (problem !== null) ctx.addIssue({ code: 'custom', path: ['value'], message: problem });
  });

export type CorrectionInput = z.infer<typeof correctionSchema>;

/**
 * A whole pass over a record, not one field at a time.
 *
 * An operator working through a review task usually fixes several fields at
 * once. Sending them separately would mean a request and a refetch per field,
 * and an audit trail that reads as several visits rather than one.
 */
export const correctionsSchema = z.object({
  corrections: z.array(correctionSchema).min(1).max(NORMALIZED_FIELD_KEYS.length),
});

export type CorrectionsInput = z.infer<typeof correctionsSchema>;

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

// Parses search params back into a query, dropping anything malformed.
export function fromSearchParams(params: URLSearchParams): DocumentQueryInput {
  const numeric = (key: string): number | undefined => {
    const raw = params.get(key);
    if (raw === null) return undefined;

    const value = Number(raw);
    return Number.isInteger(value) ? value : undefined;
  };

  const parsed = documentQuerySchema.safeParse({
    status: params.getAll('status').length > 0 ? params.getAll('status') : undefined,
    documentType: params.getAll('type').length > 0 ? params.getAll('type') : undefined,
    confidence: params.getAll('confidence').length > 0 ? params.getAll('confidence') : undefined,
    search: params.get('q') ?? undefined,
    needsAttention: params.get('attention') === '1' ? true : undefined,
    batchId: params.get('batch') ?? undefined,
    errorCode: params.getAll('cause').length > 0 ? params.getAll('cause') : undefined,
    sortField: params.get('sort') ?? undefined,
    sortDirection: params.get('dir') ?? undefined,
    page: numeric('page'),
    pageSize: numeric('pageSize'),
  });

  return parsed.success ? parsed.data : {};
}
