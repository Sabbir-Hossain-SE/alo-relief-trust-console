'use client';

import { memo, useCallback, useMemo } from 'react';
import { DataGrid, type GridPaginationModel, type GridSortModel } from '@mui/x-data-grid';
import Paper from '@mui/material/Paper';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import type { DocumentSummary } from '@/domain/document';
import { PAGE_SIZE_OPTIONS, gridPageSize } from '@/domain/pagination';
import { SORT_FIELDS } from '@/domain/sort';
import { useDocuments } from '@/store/polling';
import { usePreferences } from '@/store/usePreferences';
import { useDocumentQuery } from '../useDocumentQuery';
import { documentColumns } from './columns';

/**
 * Row heights owned here rather than inherited from MUI's density.
 *
 * `density` is a multiplier over whatever `rowHeight` says, and the factor is
 * not a number the library exports — so with the toggle driving it, the rendered
 * row height is unknowable from here and the container cannot be sized in whole
 * rows. The grid is pinned to `standard`, which is the factor of one, and the
 * preference drives the row height directly instead. That is what a density
 * toggle is for; the padding either side of it is MUI's business.
 */
export const ROW_HEIGHT = { comfortable: 56, compact: 40 } as const;
const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 52;

/** Roughly a laptop viewport once the bar, the page header and the filters are out. */
const TARGET_BODY_HEIGHT = 560;

/**
 * Sizes the grid to whole rows.
 *
 * A fixed height cuts the last row in half wherever it happens to land, which
 * reads as a rendering fault rather than as a scroll affordance — and it moves
 * with the density toggle, so it cannot be corrected with one number.
 */
export function gridHeight(rowHeight: number): number {
  const rows = Math.max(4, Math.floor(TARGET_BODY_HEIGHT / rowHeight));
  return HEADER_HEIGHT + FOOTER_HEIGHT + rows * rowHeight;
}

/** How many rows a given height shows, for asserting that none is half of one. */
export function visibleRows(height: number, rowHeight: number): number {
  return (height - HEADER_HEIGHT - FOOTER_HEIGHT) / rowHeight;
}

type DocumentsGridProps = {
  onOpen?: (document: DocumentSummary) => void;
};

/**
 * Memoised on purpose, not defensively. Its parent re-renders once per chunk
 * while an export streams, with props that do not change; measured, that was
 * the whole of the export's render cost.
 */
export const DocumentsGrid = memo(function DocumentsGrid({ onOpen }: DocumentsGridProps) {
  const { query, goToPage, update, isFiltered, clear } = useDocumentQuery();
  const { density, pageSize: preferredPageSize } = usePreferences();

  // Resolved rather than taken as given. `pageSize` arrives from the URL, which
  // anyone can edit, and MUI throws rather than clamps when it is handed a page
  // larger than its licence allows — so ?pageSize=200 took the whole route down
  // and left the operator on the browser's own error page.
  const pageSize = gridPageSize(query.pageSize ?? preferredPageSize);
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
      // Checked rather than cast: a column the engine cannot sort by must not
      // reach the URL, where the server would drop it and keep the direction.
      const field = SORT_FIELDS.find((candidate) => candidate === next?.field);
      update(
        next === undefined || field === undefined
          ? { sortField: undefined, sortDirection: undefined }
          : { sortField: field, sortDirection: next.sort ?? 'desc' },
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

  const rowHeight = ROW_HEIGHT[density];

  return (
    // The height goes on the grid rather than on the Paper around it: Paper
    // carries a border, so a height set there is two pixels short by the time
    // the rows are laid out, which is all it takes to slice the last one.
    <Paper sx={{ width: '100%' }}>
      <DataGrid<DocumentSummary>
        rows={data?.rows ?? []}
        columns={documentColumns}
        // Stable identity, so a refetch updates rows instead of remounting them.
        getRowId={(row) => row.id}
        loading={isFetching}
        density="standard"
        rowHeight={rowHeight}
        columnHeaderHeight={HEADER_HEIGHT}
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
        // The grid publishes `onRowClick` from the row's DOM click alone, and
        // its own Enter handling is reserved for cell editing. Without this the
        // only way into a document is a mouse, on the screen the archive is
        // mostly worked from.
        onCellKeyDown={
          onOpen === undefined
            ? undefined
            : (params, event) => {
                if (event.key !== 'Enter') return;
                event.defaultMuiPrevented = true;
                onOpen(params.row);
              }
        }
        sx={{
          border: 0,
          height: gridHeight(rowHeight),
          '& .MuiDataGrid-row': { cursor: onOpen === undefined ? 'default' : 'pointer' },
        }}
        aria-label="Documents in the archive"
      />
    </Paper>
  );
});
