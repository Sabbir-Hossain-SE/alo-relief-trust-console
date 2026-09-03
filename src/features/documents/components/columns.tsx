'use client';

import type { GridColDef } from '@mui/x-data-grid';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { ConfidenceMeter } from '@/components/data/ConfidenceMeter';
import { StatusChip } from '@/components/data/StatusChip';
import { DOCUMENT_TYPE_LABELS, type DocumentSummary } from '@/domain/document';
import { describeError } from '@/domain/errors';
import { formatDate } from '@/lib/format/date';

// Values the pipeline has not produced yet, shown as absent rather than as zero.
function Absent() {
  return (
    <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }} aria-label="None">
      —
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
      const extracted = row.status === 'completed' || row.status === 'needs_review';
      return extracted ? <ConfidenceMeter score={row.confidence} /> : <Absent />;
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
        <Tooltip title={spec.remedy}>
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
