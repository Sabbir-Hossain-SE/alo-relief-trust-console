import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { DocumentDetail } from '@/domain/document';
import {
  apiUrl,
  toSearchParams,
  type ArchiveAnalytics,
  type ArchiveSummary,
  type CorrectionsInput,
  type CreateBatchInput,
  type DocumentQueryInput,
  type ManualEntryResult,
  type RetryResult,
} from '@/server/api-contract';
import type { QueryResult } from '@/server/corpus/query';
import type { BatchSummary } from '@/server/simulator/batch';

/**
 * The only place the app talks to the API.
 *
 * Identifiers are encoded into the path. They arrive from the address bar as
 * often as from the archive, and `?doc=a/b` unencoded is a request for a route
 * that does not exist rather than for a document that does not.
 *
 * Tags are deliberately coarse. A batch finishing changes rows, counts and the
 * batch itself, and the alternative — tracking which of 100,000 documents moved
 * — would cost far more than refetching one page of fifty.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: apiUrl() }),
  tagTypes: ['Document', 'Batch', 'Summary'],
  endpoints: (build) => ({
    getSummary: build.query<ArchiveSummary, void>({
      query: () => '/summary',
      providesTags: ['Summary'],
    }),

    getAnalytics: build.query<ArchiveAnalytics, void>({
      query: () => '/analytics',
      // Same tag as the counts: anything that moves a document moves a
      // breakdown of documents.
      providesTags: ['Summary'],
    }),

    getDocuments: build.query<QueryResult, DocumentQueryInput>({
      query: (input) => `/documents?${toSearchParams(input).toString()}`,
      // Named, so a correction can refresh the lists without also refetching
      // the record whose new state it already holds.
      providesTags: [{ type: 'Document', id: 'LIST' }],
    }),

    getDocument: build.query<DocumentDetail, string>({
      query: (id) => `/documents/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'Document', id }],
    }),

    correctDocument: build.mutation<DocumentDetail, { id: string } & CorrectionsInput>({
      query: ({ id, ...body }) => ({
        url: `/documents/${encodeURIComponent(id)}`,
        method: 'PATCH',
        body,
      }),
      // The response is the corrected record, so the drawer reads it from the
      // cache at once instead of asking for it again a round trip later.
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(api.util.updateQueryData('getDocument', id, () => data));
      },
      // A correction can resolve the review that put the document in the queue,
      // so the lists and the counts still change, not just this record.
      invalidatesTags: [{ type: 'Document', id: 'LIST' }, 'Summary'],
    }),

    retryDocument: build.mutation<RetryResult, string>({
      query: (id) => ({ url: `/documents/${encodeURIComponent(id)}/retry`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Document', id },
        'Document',
        'Batch',
        'Summary',
      ],
    }),

    sendDocumentToManualEntry: build.mutation<ManualEntryResult, string>({
      query: (id) => ({ url: `/documents/${encodeURIComponent(id)}/manual-entry`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Document', id },
        'Document',
        'Batch',
        'Summary',
      ],
    }),

    getBatches: build.query<BatchSummary[], void>({
      query: () => '/batches',
      providesTags: ['Batch'],
    }),

    getBatch: build.query<BatchSummary, string>({
      query: (id) => `/batches/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'Batch', id }],
    }),

    createBatch: build.mutation<BatchSummary, CreateBatchInput>({
      query: (body) => ({ url: '/batches', method: 'POST', body }),
      invalidatesTags: ['Batch', 'Document', 'Summary'],
    }),

    retryBatch: build.mutation<RetryResult, { id: string; indices?: number[] }>({
      query: ({ id, indices }) => ({
        url: `/batches/${encodeURIComponent(id)}/retry`,
        method: 'POST',
        body: { indices },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Batch', id },
        'Batch',
        'Document',
        'Summary',
      ],
    }),
    sendBatchToManualEntry: build.mutation<ManualEntryResult, string>({
      query: (id) => ({ url: `/batches/${encodeURIComponent(id)}/manual-entry`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Batch', id },
        'Batch',
        'Document',
        'Summary',
      ],
    }),
  }),
});

export const {
  useGetSummaryQuery,
  useGetAnalyticsQuery,
  useGetDocumentsQuery,
  useGetDocumentQuery,
  useCorrectDocumentMutation,
  useRetryDocumentMutation,
  useGetBatchesQuery,
  useGetBatchQuery,
  useCreateBatchMutation,
  useRetryBatchMutation,
  useSendDocumentToManualEntryMutation,
  useSendBatchToManualEntryMutation,
} = api;
