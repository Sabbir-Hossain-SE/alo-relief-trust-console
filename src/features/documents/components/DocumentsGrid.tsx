'use client';

import { useCallback, useMemo } from 'react';
import { DataGrid, type GridPaginationModel, type GridSortModel } from '@mui/x-data-grid';
import Paper from '@mui/material/Paper';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import type { DocumentSummary } from '@/domain/document';
import { DEFAULT_PAGE_SIZE, type SortField } from '@/server/corpus/query';
import { useDocuments } from '@/store/polling';
import { usePreferences } from '@/store/usePreferences';
import { useDocumentQuery } from '../useDocumentQuery';
import { documentColumns } from './columns';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

type DocumentsGridProps = {
  onOpen?: (document: DocumentSummary) => void;
};

export function DocumentsGrid({ onOpen }: DocumentsGridProps) {
  const { query, goToPage, update, isFiltered, clear } = useDocumentQuery();
  const { density, pageSize: preferredPageSize } = usePreferences();

  const pageSize = query.pageSize ?? preferredPageSize ?? DEFAULT_PAGE_SIZE;
  const { data, isFetching, isError, refetch } = useDocuments({ ...query, pageSize });

  const paginationModel = useMemo<GridPaginationModel>(
    () => ({ page: query.page ?? 0, pageSize }),
    [query.page, pageSize],
  );

  const sortModel = useMemo<GridSortModel>(
    () =>
      query.sortField
        ? [{ field: query.sortField, sort: query.sortDirection ?? 'desc' }]
        : [{ field: 'uploadedAt', sort: 'desc' }],
    [query.sortField, query.sortDirection],
  );

  const handleSort = useCallback(
    (model: GridSortModel) => {
      const next = model[0];
      update(
        next === undefined
          ? { sortField: undefined, sortDirection: undefined }
          : { sortField: next.field as SortField, sortDirection: next.sort ?? 'desc' },
      );
    },
    [update],
  );

  if (isError) {
    return (
      <Paper>
        <ErrorState
          title="The documents could not be loaded"
          description="The request for this page of the archive did not come back."
          onRetry={() => void refetch()}
        />
      </Paper>
    );
  }

  // An archive with nothing in it and a filter that matches nothing are
  // different problems, and only one of them is solved by clearing filters.
  if (data !== undefined && data.total === 0) {
    return (
      <Paper>
        {isFiltered ? (
          <EmptyState
            icon={<SearchOffIcon fontSize="inherit" />}
            title="No documents match these filters"
            description="Try widening the search, or clear the filters to see the whole archive."
            action={
              <button type="button" onClick={clear} className="underline">
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            title="The archive is empty"
            description="Upload documents to start digitizing them."
          />
        )}
      </Paper>
    );
  }

  return (
    <Paper sx={{ height: 640, width: '100%' }}>
      <DataGrid<DocumentSummary>
        rows={data?.rows ?? []}
        columns={documentColumns}
        // Stable identity, so a refetch updates rows instead of remounting them.
        getRowId={(row) => row.id}
        loading={isFetching}
        density={density}
        rowCount={data?.total ?? 0}
        paginationMode="server"
        sortingMode="server"
        filterMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={(model) => goToPage(model.page, model.pageSize)}
        sortModel={sortModel}
        onSortModelChange={handleSort}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        disableColumnFilter
        disableRowSelectionOnClick
        onRowClick={onOpen === undefined ? undefined : ({ row }) => onOpen(row)}
        sx={{
          border: 0,
          '& .MuiDataGrid-row': { cursor: onOpen === undefined ? 'default' : 'pointer' },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
        }}
        aria-label="Documents in the archive"
      />
    </Paper>
  );
}
