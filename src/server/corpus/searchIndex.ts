import { LOCATION_POOL, NAME_POOL } from './pools.generated';

/**
 * Free-text search runs against the pooled strings, not the rows. There are
 * 2,000 names and 192 locations behind 100,000 documents, so matching the pools
 * once and then testing rows by integer id is roughly fiftyfold less string work
 * than lowercasing a name per row.
 */
export type SearchIndex = {
  readonly names: readonly string[];
  readonly locations: readonly string[];
};

let cached: SearchIndex | null = null;

// Builds the lowercased pools once per process.
export function getSearchIndex(): SearchIndex {
  cached ??= {
    names: NAME_POOL.map((value) => value.toLowerCase()),
    locations: LOCATION_POOL.map((value) => value.toLowerCase()),
  };

  return cached;
}

// Collects the pool ids whose value contains the term.
function matchPool(pool: readonly string[], term: string): Set<number> {
  const matches = new Set<number>();

  for (let id = 0; id < pool.length; id += 1) {
    if ((pool[id] as string).includes(term)) matches.add(id);
  }

  return matches;
}

export type SearchTargets = {
  /** Name pool ids matching the term, or null when the term matched no names. */
  nameIds: Set<number>;
  locationIds: Set<number>;
  /** Set when the term looks like a document index, so "42" finds ARC-000042. */
  documentIndex: number | null;
};

/**
 * Resolves a search term into the ids a row scan can test with integer lookups.
 * Returning ids rather than a predicate keeps the hot loop free of string work.
 */
export function resolveSearch(term: string): SearchTargets {
  const normalized = term.trim().toLowerCase();
  const index = getSearchIndex();

  const digits = /^(?:arc-)?(\d{1,9})$/.exec(normalized);

  return {
    nameIds: matchPool(index.names, normalized),
    locationIds: matchPool(index.locations, normalized),
    documentIndex: digits ? Number(digits[1]) : null,
  };
}

// Reports whether a term is worth running at all.
export function isSearchable(term: string | undefined): term is string {
  return typeof term === 'string' && term.trim().length > 0;
}
