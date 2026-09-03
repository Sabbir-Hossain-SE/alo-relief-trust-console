import { toSearchParams, type DocumentQueryInput } from '@/server/api-contract';

/**
 * Deep link from an overview figure into the documents behind it.
 *
 * Built with the same serializer the API query uses, so a tile and the request
 * its link produces cannot drift apart — which is the only reason the figure on
 * the tile and the count on the grid can be trusted to agree.
 */
export function documentsHref(query: DocumentQueryInput): string {
  const params = toSearchParams(query).toString();
  return params.length > 0 ? `/documents?${params}` : '/documents';
}

/**
 * The statuses whose confidence means anything.
 *
 * A confidence filter on its own also matches every pending and failed
 * document, which is stored at 0 and so lands in the low band. The tile counts
 * extracted documents, so its link has to say so or it opens a screen showing
 * several times the figure that was clicked.
 */
export const EXTRACTED_STATUSES = ['completed', 'needs_review'] as const;
