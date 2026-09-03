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
      providesTags: ['Document'],
    }),

    getDocument: build.query<DocumentDetail, string>({
      query: (id) => `/documents/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Document', id }],
    }),

    correctDocument: build.mutation<DocumentDetail, { id: string } & CorrectionsInput>({
      query: ({ id, ...body }) => ({ url: `/documents/${id}`, method: 'PATCH', body }),
      // A correction can resolve the review that put the document in the queue,
      // so the list and the counts both change, not just this record.
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Document', id },
        'Document',
        'Summary',
      ],
    }),

    retryDocument: build.mutation<RetryResult, string>({
      query: (id) => ({ url: `/documents/${id}/retry`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Document', id },
        'Document',
        'Batch',
        'Summary',
      ],
    }),

    sendDocumentToManualEntry: build.mutation<ManualEntryResult, string>({
      query: (id) => ({ url: `/documents/${id}/manual-entry`, method: 'POST' }),
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
      query: (id) => `/batches/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Batch', id }],
    }),

    createBatch: build.mutation<BatchSummary, CreateBatchInput>({
      query: (body) => ({ url: '/batches', method: 'POST', body }),
      invalidatesTags: ['Batch', 'Document', 'Summary'],
    }),

    retryBatch: build.mutation<RetryResult, { id: string; indices?: number[] }>({
      query: ({ id, indices }) => ({
        url: `/batches/${id}/retry`,
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
      query: (id) => ({ url: `/batches/${id}/manual-entry`, method: 'POST' }),
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
