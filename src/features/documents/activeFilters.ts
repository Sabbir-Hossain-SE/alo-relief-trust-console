import { CONFIDENCE_BAND_LABELS, type ConfidenceBand } from '@/domain/confidence';
import { DOCUMENT_TYPE_LABELS, type DocumentType } from '@/domain/document';
import { STATUS_LABELS, type ProcessingStatus } from '@/domain/status';
import type { DocumentQueryInput } from '@/server/api-contract';

/** One narrowing currently applied, and the change that lifts just that one. */
export type ActiveFilter = {
  id: string;
  label: string;
  patch: Partial<DocumentQueryInput>;
};

// Drops one value from a multi-select filter, clearing it when nothing is left.
function without<T>(values: readonly T[], value: T): T[] | undefined {
  const rest = values.filter((item) => item !== value);
  return rest.length > 0 ? rest : undefined;
}

/**
 * The filters an operator currently has on, in the order they are offered.
 *
 * Search is deliberately not among them. It has a field of its own that shows
 * the term and clears it, so a chip repeating it would be a second control for
 * the same thing rather than a summary of anything hidden.
 */
export function activeFilters(query: DocumentQueryInput): ActiveFilter[] {
  const filters: ActiveFilter[] = [];

  for (const type of query.documentType ?? []) {
    filters.push({
      id: `type:${type}`,
      label: DOCUMENT_TYPE_LABELS[type as DocumentType],
      patch: { documentType: without(query.documentType ?? [], type) },
    });
  }

  for (const status of query.status ?? []) {
    filters.push({
      id: `status:${status}`,
      label: STATUS_LABELS[status as ProcessingStatus],
      patch: { status: without(query.status ?? [], status) },
    });
  }

  for (const band of query.confidence ?? []) {
    filters.push({
      id: `confidence:${band}`,
      label: CONFIDENCE_BAND_LABELS[band as ConfidenceBand],
      patch: { confidence: without(query.confidence ?? [], band) },
    });
  }

  if (query.batchId !== undefined) {
    filters.push({
      id: 'batch',
      label: `Batch ${query.batchId}`,
      patch: { batchId: undefined },
    });
  }

  if (query.needsAttention === true) {
    filters.push({
      id: 'attention',
      label: 'Needs attention',
      patch: { needsAttention: undefined },
    });
  }

  return filters;
}
