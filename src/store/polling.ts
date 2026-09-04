'use client';

import { useState } from 'react';
import type { DocumentQueryInput } from '@/server/api-contract';
import {
  useGetAnalyticsQuery,
  useGetBatchQuery,
  useGetBatchesQuery,
  useGetDocumentsQuery,
  useGetSummaryQuery,
} from './api';

/** Fast enough to feel live, slow enough not to hammer the worker. */
export const POLL_INTERVAL_MS = 1500;

/**
 * How soon to ask again, given the last answer.
 *
 * An error stops the clock as surely as the work finishing does. Asking every
 * second and a half for a batch that is not there filled the console with 404s
 * and made the visible "Try again" a lie — it is the retry, and the one the
 * operator controls.
 */
export function nextPollInterval(isError: boolean, settled: boolean | undefined): number {
  return isError || settled === true ? 0 : POLL_INTERVAL_MS;
}

/**
 * Every poll here skips while the tab is in the background.
 *
 * Each tick re-reads the archive — a hundred thousand rows filtered and sorted
 * in the worker — and a tab nobody is looking at gains nothing from it but a
 * warm laptop. The clock is not lost: the simulation advances by observed
 * time, so the first poll after the tab comes back reports where the batch
 * actually is. Needs `setupListeners` on the store, which the provider does.
 */

/**
 * Watches one batch, polling only while it still has work.
 *
 * A fixed `pollingInterval` keeps refetching long after a batch has settled,
 * burning battery and CPU for no new information. The interval is derived from
 * the batch's own last response, and adjusted during render rather than in an
 * effect, so polling stops on the same commit that reports the work finished
 * instead of one tick later.
 */
export function useBatch(batchId: string | undefined) {
  const [interval, setPollInterval] = useState(POLL_INTERVAL_MS);

  const result = useGetBatchQuery(batchId ?? '', {
    skip: batchId === undefined,
    pollingInterval: interval,
    skipPollingIfUnfocused: true,
  });

  const desired = nextPollInterval(result.isError, result.data?.settled);
  if (interval !== desired) setPollInterval(desired);

  return result;
}

/** Watches every batch, polling only while at least one is unfinished. */
export function useBatches() {
  const [interval, setPollInterval] = useState(POLL_INTERVAL_MS);

  const result = useGetBatchesQuery(undefined, {
    pollingInterval: interval,
    skipPollingIfUnfocused: true,
  });

  const allSettled =
    result.data === undefined ? undefined : result.data.every((batch) => batch.settled);
  const desired = nextPollInterval(result.isError, allSettled);
  if (interval !== desired) setPollInterval(desired);

  return result;
}

/**
 * Reports whether processing is currently changing the archive.
 *
 * Backed by `useBatches`, so it carries its own polling rather than depending
 * on some other component happening to subscribe. Identical subscriptions are
 * deduplicated, so several callers still produce one request.
 */
export function useArchiveIsChanging(): boolean {
  const { data } = useBatches();
  return data?.some((batch) => !batch.settled) ?? false;
}

/** The archive counts, refreshed only while a batch is moving them. */
export function useSummary() {
  const changing = useArchiveIsChanging();

  return useGetSummaryQuery(undefined, {
    pollingInterval: changing ? POLL_INTERVAL_MS : 0,
    skipPollingIfUnfocused: true,
  });
}

/** The archive breakdowns, on the same terms as the counts they sit beside. */
export function useAnalytics() {
  const changing = useArchiveIsChanging();

  return useGetAnalyticsQuery(undefined, {
    pollingInterval: changing ? POLL_INTERVAL_MS : 0,
    skipPollingIfUnfocused: true,
  });
}

/** A page of documents, refreshed only while processing is changing what is on it. */
export function useDocuments(query: DocumentQueryInput) {
  const changing = useArchiveIsChanging();

  return useGetDocumentsQuery(query, {
    pollingInterval: changing ? POLL_INTERVAL_MS : 0,
    skipPollingIfUnfocused: true,
  });
}
