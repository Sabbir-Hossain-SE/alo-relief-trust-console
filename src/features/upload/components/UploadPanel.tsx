'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';

type UploadPanelProps = {
  children: ReactNode;
  /** Highlights the frame while something is being dragged over it. */
  isActive?: boolean;
  dimmed?: boolean;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
};

/**
 * The frame every upload state renders into.
 *
 * Upload moves through three states — waiting, indexing, ready — and each used
 * to bring its own container. Swapping a tall dashed drop area for a short card
 * made the page jump on every transition, which reads as three different
 * screens rather than one screen changing. Fixing the frame means only the
 * contents move.
 */
export function UploadPanel({
  children,
  isActive = false,
  dimmed = false,
  onDragOver,
  onDragLeave,
  onDrop,
}: UploadPanelProps) {
  return (
    <Box
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-10 text-center"
      sx={(theme) => ({
        minHeight: 320,
        border: '1px dashed',
        borderColor: isActive ? 'primary.main' : 'divider',
        backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
        opacity: dimmed ? 0.6 : 1,
        transition: theme.transitions.create(['border-color', 'background-color']),
      })}
    >
      {children}
    </Box>
  );
}
