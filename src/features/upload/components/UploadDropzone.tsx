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
import { useUploadAffordances } from '../useUploadAffordances';
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
  const { canDrop, canPickFolder } = useUploadAffordances();

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    // Said explicitly: without it Firefox shows a "move" cursor and Safari
    // sometimes none, and neither tells the operator the drop will be taken.
    event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
    if (!disabled) setIsOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    // Fires again every time the pointer crosses into a child — the icon, the
    // text, a button — so the highlight flickered all the way across the panel.
    // Only a leave that lands outside the panel itself counts.
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;

    setIsOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsOver(false);
    if (disabled) return;

    // Must be read synchronously: the item list is emptied once the drop
    // handler returns, so deferring this loses the folders.
    const entries = entriesFromDataTransfer(event.dataTransfer);
    if (entries.length > 0) {
      onEntries(entries);
      return;
    }

    // Text or a link dragged in from another window is a drop with no files in
    // it. Indexing it would announce "0 documents ready", so it is ignored.
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  return (
    <UploadPanel
      isActive={isOver}
      dimmed={disabled}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CloudUploadOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />

      {/* A phone has no window to drag a file out of, so the panel does not
          ask for one; it says what the device can do. */}
      <Box>
        <Typography variant="h3" component="p">
          {canDrop ? 'Drop documents or a folder here' : 'Choose documents to upload'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {canDrop
            ? 'A whole archive folder is fine — it is indexed without freezing the page.'
            : 'As many as you like — they are indexed here before anything is sent.'}
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

        {canPickFolder ? (
          <Button
            variant="outlined"
            disabled={disabled}
            onClick={() => folderInput.current?.click()}
            startIcon={<FolderOpenIcon />}
          >
            Choose a folder
          </Button>
        ) : null}
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

      {canPickFolder ? (
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          // Not in the React types, but honoured wherever the button is shown.
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          onChange={(event) => {
            onFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      ) : null}
    </UploadPanel>
  );
}
