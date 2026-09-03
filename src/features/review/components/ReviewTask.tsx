'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { ConfidenceMeter } from '@/components/data/ConfidenceMeter';
import { DOCUMENT_TYPE_LABELS, type DocumentSummary } from '@/domain/document';
import { formatDate } from '@/lib/format/date';

export const TASK_HEIGHT = 76;

type ReviewTaskProps = {
  row: DocumentSummary;
  isOpen: boolean;
  onOpen: () => void;
};

/**
 * One item of work in the queue.
 *
 * A button rather than a table row: this is a thing to open and act on, and a
 * button is reachable and operable from a keyboard without anything being
 * reimplemented.
 */
export function ReviewTask({ row, isOpen, onOpen }: ReviewTaskProps) {
  return (
    <ButtonBase
      onClick={onOpen}
      aria-label={`Review ${row.fileName}`}
      className="flex w-full items-center gap-4 px-4 text-left"
      sx={(theme) => ({
        height: TASK_HEIGHT,
        justifyContent: 'flex-start',
        backgroundColor: isOpen ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) },
      })}
    >
      <Box className="w-0 min-w-0 flex-1">
        <Typography variant="body2" className="truncate">
          {row.personName ?? 'No name extracted'}
        </Typography>
        <Typography variant="caption" className="tabular truncate" sx={{ color: 'text.secondary' }}>
          {row.id} · {row.fileName}
        </Typography>
      </Box>

      <Box className="hidden w-40 shrink-0 sm:block">
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {DOCUMENT_TYPE_LABELS[row.documentType]}
        </Typography>
        <Typography variant="caption" component="p" sx={{ color: 'text.disabled' }}>
          {formatDate(row.uploadedAt)}
        </Typography>
      </Box>

      <Box className="w-28 shrink-0">
        <ConfidenceMeter score={row.confidence} />
      </Box>
    </ButtonBase>
  );
}
