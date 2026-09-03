'use client';

import Button from '@mui/material/Button';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import type { ExportState } from '../useCsvExport';

type ExportButtonProps = {
  state: ExportState;
  onStart: () => void;
  onCancel: () => void;
};

/**
 * Starts a CSV of the current view, and offers a way out of one already running.
 *
 * The cancel replaces the start rather than sitting beside it: an export cannot
 * be started twice, and two buttons where only one is ever usable is a puzzle
 * rather than a choice.
 */
export function ExportButton({ state, onStart, onCancel }: ExportButtonProps) {
  if (state.status === 'running') {
    return (
      <Button variant="outlined" onClick={onCancel}>
        Cancel export
      </Button>
    );
  }

  return (
    <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={onStart}>
      Export CSV
    </Button>
  );
}
