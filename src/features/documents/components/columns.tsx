'use client';

import type { GridColDef } from '@mui/x-data-grid';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { ConfidenceMeter } from '@/components/data/ConfidenceMeter';
import { StatusChip } from '@/components/data/StatusChip';
import { DOCUMENT_TYPE_LABELS, type DocumentSummary } from '@/domain/document';
import { describeError } from '@/domain/errors';
import { isExtracted } from '@/domain/status';
import { formatDate } from '@/lib/format/date';

// Values the pipeline has not produced yet, shown as absent rather than as zero.
function Absent() {
  return (
    // An em-dash reads as punctuation or as nothing at all. `aria-label` on a
    // roleless span is not a name, so the word has to be in the tree itself.
    <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
      <span aria-hidden>—</span>
      <span className="sr-only">None</span>
    </Typography>
  );
}

function Mono({ children }: { children: string }) {
  return (
    <Typography component="span" variant="body2" className="tabular">
      {children}
    </Typography>
  );
}

/**
 * Sorting and filtering happen on the server, so every column turns both off.
 * Leaving them on would let the grid quietly re-sort the fifty rows it has
 * rather than the hundred thousand it is describing.
 */
export const documentColumns: GridColDef<DocumentSummary>[] = [
  {
    field: 'id',
    headerName: 'ID',
    width: 130,
    filterable: false,
    // Not among the sorts the query engine performs. Offered anyway, the click
    // wrote a sort the server dropped, and the header arrows described an
    // order the rows were not in.
    sortable: false,
    renderCell: ({ row }) => <Mono>{row.id}</Mono>,
  },
  {
    field: 'fileName',
    headerName: 'File',
    flex: 1.4,
    minWidth: 220,
    filterable: false,
    sortable: false,
    renderCell: ({ row }) => (
      <Tooltip title={row.fileName}>
        <Typography component="span" variant="body2" className="tabular truncate">
          {row.fileName}
        </Typography>
      </Tooltip>
    ),
  },
  {
    field: 'documentType',
    headerName: 'Type',
    width: 160,
    filterable: false,
    valueFormatter: (value: DocumentSummary['documentType']) => DOCUMENT_TYPE_LABELS[value],
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 150,
    filterable: false,
    renderCell: ({ row }) => <StatusChip status={row.status} />,
  },
  {
    field: 'personName',
    headerName: 'Person',
    flex: 1,
    minWidth: 160,
    filterable: false,
    sortable: false,
    renderCell: ({ row }) =>
      row.personName === undefined ? <Absent /> : <span>{row.personName}</span>,
  },
  {
    field: 'location',
    headerName: 'Location',
    flex: 1,
    minWidth: 140,
    filterable: false,
    sortable: false,
    renderCell: ({ row }) =>
      row.location === undefined ? <Absent /> : <span>{row.location}</span>,
  },
  {
    field: 'confidence',
    headerName: 'Confidence',
    width: 140,
    filterable: false,
    renderCell: ({ row }) => {
      // A document that was never extracted has no confidence, and rendering it
      // as 0% would read as "certainly wrong" rather than "not attempted".
      return isExtracted(row.status) ? <ConfidenceMeter score={row.confidence} /> : <Absent />;
    },
  },
  {
    field: 'errorCode',
    headerName: 'Problem',
    flex: 1,
    minWidth: 180,
    filterable: false,
    sortable: false,
    renderCell: ({ row }) => {
      if (row.errorCode === undefined) return <Absent />;

      const spec = describeError(row.errorCode);
      return (
        // `describeChild` keeps the remedy as a description. Without it MUI puts
        // it in `aria-label`, so the cell announced the remedy instead of the
        // failure it is showing — a name that does not match its visible text.
        <Tooltip title={spec.remedy} describeChild>
          <Typography component="span" variant="body2" sx={{ color: 'status.failed.ink' }}>
            {spec.title}
          </Typography>
        </Tooltip>
      );
    },
  },
  {
    field: 'uploadedAt',
    headerName: 'Uploaded',
    width: 130,
    filterable: false,
    valueFormatter: (value: number) => formatDate(value),
  },
];
