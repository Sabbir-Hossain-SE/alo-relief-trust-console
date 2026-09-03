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
  const apply = useCallback(
    (next: DocumentQueryInput, history: 'push' | 'replace') => {
      const params = toSearchParams(next).toString();
      const url = params.length > 0 ? `${pathname}?${params}` : pathname;

      // Scroll is preserved so the grid does not jump on every change.
      if (history === 'push') router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [pathname, router],
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
    query.needsAttention === true ||
    query.batchId !== undefined ||
    (query.search ?? '').length > 0;

  return { query, update, goToPage, clear, isFiltered };
}
