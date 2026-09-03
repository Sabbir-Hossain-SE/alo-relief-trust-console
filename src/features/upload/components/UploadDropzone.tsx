'use client';

import { useRef, useState, type DragEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { ACCEPT_ATTRIBUTE } from '@/lib/file-ingest/validate';
import type { FsEntry } from '@/lib/file-ingest/types';
import { entriesFromDataTransfer } from '@/lib/file-ingest/walk';
import { UploadPanel } from './UploadPanel';

type UploadDropzoneProps = {
  disabled?: boolean;
  onEntries: (entries: FsEntry[]) => void;
  onFiles: (files: File[]) => void;
};

/**
 * Drop target for files and whole folders.
 *
 * The two buttons drive real file inputs rather than the drop area itself:
 * dropping is not available from a keyboard, so an operator who cannot drag
 * still has an equivalent path rather than an inert box.
 */
export function UploadDropzone({ disabled = false, onEntries, onFiles }: UploadDropzoneProps) {
  const [isOver, setIsOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsOver(false);
    if (disabled) return;

    // Must be read synchronously: the item list is emptied once the drop
    // handler returns, so deferring this loses the folders.
    const entries = entriesFromDataTransfer(event.dataTransfer);

    if (entries.length > 0) onEntries(entries);
    else onFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <UploadPanel
      isActive={isOver}
      dimmed={disabled}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
    >
      <CloudUploadOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />

      <Box>
        <Typography variant="h3" component="p">
          Drop documents or a folder here
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          A whole archive folder is fine — it is indexed without freezing the page.
        </Typography>
      </Box>

      <Box className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="contained"
          disabled={disabled}
          onClick={() => fileInput.current?.click()}
          startIcon={<CloudUploadOutlinedIcon />}
        >
          Choose files
        </Button>

        <Button
          variant="outlined"
          disabled={disabled}
          onClick={() => folderInput.current?.click()}
          startIcon={<FolderOpenIcon />}
        >
          Choose a folder
        </Button>
      </Box>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        hidden
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />

      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        // Not in the React types, but supported everywhere this app runs.
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
    </UploadPanel>
  );
}
