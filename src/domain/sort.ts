/**
 * The orders the archive can be read in.
 *
 * A leaf on purpose: the grid and the wire contract need only these names, and
 * reaching them through the query engine dragged the name and location pools —
 * fourteen kilobytes that only the handlers read — into every route's bundle.
 */
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
