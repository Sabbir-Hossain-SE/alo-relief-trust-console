import { z } from 'zod';
import { DOCUMENT_TYPES, NORMALIZED_FIELD_KEYS } from '@/domain/document';
import { PROCESSING_STATUSES } from '@/domain/status';
import { SORT_FIELDS } from './corpus/query';

/**
 * The wire contract, shared by the handlers and the client so the two cannot
 * drift. Parsed rather than cast: query strings arrive as text, and a grid that
 * puts its state in the URL will eventually be handed something malformed.
 */

export const API_BASE = '/api';

export const documentQuerySchema = z.object({
  status: z.array(z.enum(PROCESSING_STATUSES)).optional(),
  documentType: z.array(z.enum(DOCUMENT_TYPES)).optional(),
  confidence: z.array(z.enum(['high', 'medium', 'low'])).optional(),
  search: z.string().optional(),
  needsAttention: z.boolean().optional(),
  batchId: z.string().min(1).max(64).optional(),
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

export const correctionSchema = z.object({
  field: z.enum(NORMALIZED_FIELD_KEYS),
  value: z.string().trim().max(200),
});

export type CorrectionInput = z.infer<typeof correctionSchema>;

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
    sortField: params.get('sort') ?? undefined,
    sortDirection: params.get('dir') ?? undefined,
    page: numeric('page'),
    pageSize: numeric('pageSize'),
  });

  return parsed.success ? parsed.data : {};
}
