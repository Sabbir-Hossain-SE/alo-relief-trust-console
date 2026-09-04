'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { fromSearchParams, toSearchParams, type DocumentQueryInput } from '@/server/api-contract';

/**
 * The grid's view state lives in the URL.
 *
 * Chosen over component state or persistence because it is the only option that
 * makes a filtered view shareable, survives a refresh, and gives browser
 * back/forward for free. It is also the fastest way for a reviewer to reproduce
 * a specific screen.
 *
 * Parsed with Zod on the way in: a URL is user-editable, and a bad parameter
 * should fall back to a sane view rather than break the page.
 */
export function useDocumentQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo<DocumentQueryInput>(
    () => fromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  /**
   * Deliberate actions push, so back and forward step through them. Typing
   * replaces, because a history entry per keystroke would bury the view an
   * operator actually wants to return to.
   */
  /**
   * The open document, kept in the URL so a record can be linked to directly.
   *
   * Blank counts as absent. `?doc=` used to open the drawer on an empty id,
   * whose request matched the list route and handed the drawer a page of rows
   * to render as one record — which took the whole screen down.
   */
  const requestedId = searchParams.get('doc');
  const selectedId = requestedId !== null && requestedId.trim() !== '' ? requestedId : null;

  const apply = useCallback(
    (next: DocumentQueryInput, history: 'push' | 'replace', doc?: string | null) => {
      const params = toSearchParams(next);

      // The open document is not part of the API query, so it has to be carried
      // across explicitly or changing a filter would close the drawer.
      const nextDoc = doc === undefined ? selectedId : doc;
      if (nextDoc) params.set('doc', nextDoc);

      const search = params.toString();
      const url = search.length > 0 ? `${pathname}?${search}` : pathname;

      // Scroll is preserved so the grid does not jump on every change.
      if (history === 'push') router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [pathname, router, selectedId],
  );

  /**
   * Opens or closes the detail drawer.
   *
   * Opening pushes, so Back closes it. Closing replaces: pushed as well, the
   * closed view sat on top of the open one and Back reopened the drawer that
   * had just been dismissed.
   */
  const select = useCallback(
    (id: string | null) => apply(query, id === null ? 'replace' : 'push', id),
    [apply, query],
  );

  /** Applies a change and returns to the first page, since the result set moved. */
  const update = useCallback(
    (patch: Partial<DocumentQueryInput>, history: 'push' | 'replace' = 'push') =>
      apply({ ...query, ...patch, page: 0 }, history),
    [query, apply],
  );

  /** Moves within the current result set, leaving the filters alone. */
  const goToPage = useCallback(
    (page: number, pageSize: number) => apply({ ...query, page, pageSize }, 'push'),
    [query, apply],
  );

  const clear = useCallback(() => apply({}, 'push'), [apply]);

  const isFiltered =
    (query.status?.length ?? 0) > 0 ||
    (query.documentType?.length ?? 0) > 0 ||
    (query.confidence?.length ?? 0) > 0 ||
    (query.errorCode?.length ?? 0) > 0 ||
    query.needsAttention === true ||
    query.batchId !== undefined ||
    // Trimmed, as the search itself is: a lone space filters nothing and must
    // not claim to.
    (query.search ?? '').trim().length > 0;

  return { query, update, goToPage, clear, isFiltered, selectedId, select };
}
