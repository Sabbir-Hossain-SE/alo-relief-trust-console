'use client';

import { useCallback, useRef, useState } from 'react';
import { fileNameFrom, saveBlob } from '@/lib/csv/download';
import { apiUrl, toSearchParams, type DocumentQueryInput } from '@/server/api-contract';

/** Used when the response carries no content-disposition to name the file. */
const FALLBACK_NAME = 'documents.csv';

export type ExportState =
  | { status: 'idle' }
  /**
   * `total` is null until the response headers arrive, and stays null without
   * a length. A streamed file has no exact length ahead of time, so the server
   * offers an estimate from its first rows; `approximate` says the bar is
   * reading one.
   */
  | { status: 'running'; received: number; total: number | null; approximate?: boolean }
  | { status: 'done'; rows: number }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

/**
 * How many bytes the reader will hand back, or null when that cannot be known.
 *
 * A compressed response states the size on the wire while the reader yields
 * the decoded bytes, so the two are not comparable and the bar would fill at a
 * fifth of the way and sit there. A header that is not a number is treated the
 * same way, rather than being divided by to produce "NaN%".
 */
function bodyLength(headers: Headers): { total: number | null; approximate: boolean } {
  const encoding = headers.get('content-encoding');
  if (encoding !== null && encoding !== 'identity') return { total: null, approximate: false };

  const exact = Number(headers.get('content-length'));
  if (Number.isFinite(exact) && exact > 0) return { total: exact, approximate: false };

  const estimate = Number(headers.get('x-content-length-estimate'));
  return Number.isFinite(estimate) && estimate > 0
    ? { total: estimate, approximate: true }
    : { total: null, approximate: false };
}

// Whether a chunk moved the bar by a whole percent, which is all it can show.
function movedThePercent(previous: number, next: number, total: number | null): boolean {
  if (total === null) return true;
  return Math.floor((100 * previous) / total) !== Math.floor((100 * next) / total);
}

/** A share of the file, or null when the size is not known yet. */
export function exportFraction(state: ExportState): number | null {
  if (state.status !== 'running' || state.total === null || state.total === 0) return null;
  return Math.min(1, state.received / state.total);
}

/**
 * Downloads the current view as a CSV file.
 *
 * The response is read as a stream rather than awaited as a blob, so an export
 * of the whole archive reports progress instead of leaving a button spinning
 * for several seconds with nothing to say. Reading it also gives the operator
 * something to cancel: the request is aborted mid-body, not merely ignored.
 *
 * Deliberately outside RTK Query. A file download is not cacheable state, and
 * holding a ten-megabyte string in the store would keep it alive long after it
 * has been saved to disk.
 */
export function useCsvExport() {
  const [state, setState] = useState<ExportState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controller.current?.abort();
  }, []);

  const dismiss = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  const start = useCallback(async (query: DocumentQueryInput) => {
    // One at a time. A second start would replace the controller and leave the
    // first export running with nothing able to cancel it.
    if (controller.current !== null) return;

    // Paging and page size belong to the grid, not to the file: an export of
    // "the current view" means every row the filter matches, not the fifty
    // that happen to be on screen.
    const { page: _page, pageSize: _pageSize, ...filters } = query;
    const params = toSearchParams(filters).toString();

    const abort = new AbortController();
    controller.current = abort;
    setState({ status: 'running', received: 0, total: null });

    try {
      const response = await fetch(
        apiUrl(`/documents/export${params.length > 0 ? `?${params}` : ''}`),
        { signal: abort.signal },
      );

      if (!response.ok) throw new Error(`The export failed with ${response.status}.`);

      const { total, approximate } = bodyLength(response.headers);
      const rows = Number(response.headers.get('x-total-count') ?? '0');

      // The count is in the headers, so an empty result is known before a byte
      // of the body is read. Saving a file of nothing but column names would
      // leave the operator to open it to find out it was empty.
      if (rows === 0) {
        setState({ status: 'done', rows: 0 });
        return;
      }

      const chunks: Uint8Array[] = [];
      let received = 0;

      // A body is only absent for a response that cannot have one, which a 200
      // here never is — but the type allows null, and awaiting the blob is a
      // correct, progressless fallback rather than a crash.
      if (response.body === null) chunks.push(new Uint8Array(await response.arrayBuffer()));
      else {
        const reader = response.body.getReader();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          const before = received;
          received += value.byteLength;

          // A render per chunk re-rendered the whole view a hundred times a
          // second for a bar that can only move by whole percents.
          if (movedThePercent(before, received, total)) {
            setState({ status: 'running', received, total, approximate });
          }
        }
      }

      const blob = new Blob(chunks as BlobPart[], { type: 'text/csv;charset=utf-8' });
      // The blob holds its own copy; the chunks would otherwise stay alive for
      // as long as the download's URL does.
      chunks.length = 0;

      saveBlob(blob, fileNameFrom(response.headers.get('content-disposition'), FALLBACK_NAME));

      setState({ status: 'done', rows });
    } catch {
      // An abort is the operator getting what they asked for, not a failure.
      // Asked of our own controller rather than of the error: what a cancelled
      // fetch throws differs between the browser and Node, and sniffing for a
      // DOMException reports a deliberate cancel as a broken export under one
      // of them.
      setState(
        abort.signal.aborted
          ? { status: 'cancelled' }
          : { status: 'failed', message: 'The export could not be completed.' },
      );
    } finally {
      controller.current = null;
    }
  }, []);

  return { state, start, cancel, dismiss };
}
