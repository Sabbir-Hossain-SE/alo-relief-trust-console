/**
 * The page sizes the documents grid offers.
 *
 * One list, because four separate answers to "how many rows fit on a page" is
 * what let a hand-edited URL take the application down: the query schema
 * accepted up to 200, the backend served 200, the preference allowed three
 * values, and the grid — MUI X under its MIT licence — throws above 100.
 *
 * This is the grid's constraint, not the archive's. The review queue reads two
 * hundred records in one request on purpose and virtualizes them, so the API is
 * right to allow more than a grid page can show.
 */
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 50;

/** The largest page the grid can render. Derived, so the list stays the source. */
export const MAX_GRID_PAGE_SIZE: PageSize = PAGE_SIZE_OPTIONS[PAGE_SIZE_OPTIONS.length - 1];

export function isPageSize(value: number | undefined): value is PageSize {
  return value !== undefined && (PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

/**
 * The page size to render, given what a URL or a stored preference asked for.
 *
 * Anything the grid cannot show falls back to the default rather than being
 * passed on. A value outside the offered list is not a smaller mistake than a
 * malformed one — MUI throws above the maximum, and warns about any size
 * missing from the options it was given, so both have to be resolved here.
 */
export function gridPageSize(requested: number | undefined): PageSize {
  return isPageSize(requested) ? requested : DEFAULT_PAGE_SIZE;
}
