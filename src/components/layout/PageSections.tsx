import type { ReactNode } from 'react';
import Box from '@mui/material/Box';

/**
 * The vertical rhythm of a page: the header and each top-level block.
 *
 * One owner for the gap between sections, because the alternative — a bottom
 * margin on the header, another on one panel, a top margin on the next — is how
 * a page ends up with four different distances that all look like mistakes. A
 * gap also collapses cleanly when a section renders nothing, which a margin on
 * the section itself does not.
 *
 * Blocks inside a section are spaced at `SECTION_CONTENT_GAP`, half of this, so
 * "these belong together" and "these are separate things" read as different
 * distances rather than as the same one twice.
 */
export function PageSections({ children }: { children: ReactNode }) {
  return <Box className="flex flex-col gap-8">{children}</Box>;
}

/** The gap between blocks that belong to the same section. */
export const SECTION_CONTENT_GAP = 'flex flex-col gap-4';
