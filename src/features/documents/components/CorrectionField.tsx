'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

type CorrectionFieldProps = {
  label: string;
  /** The caption's id, so the control it wraps can be named by it. */
  labelId: string;
  /** Whether the pipeline flagged this value for a person to check. */
  needsAttention: boolean;
  /** Whether an operator has already replaced the extracted value. */
  corrected: boolean;
  children: ReactNode;
};

// One labelled row of the correction form, whatever control fills it.
export function CorrectionField({
  label,
  labelId,
  needsAttention,
  corrected,
  children,
}: CorrectionFieldProps) {
  return (
    <Box
      className="flex flex-col gap-1 rounded-lg p-2"
      sx={(theme) => ({
        backgroundColor: needsAttention
          ? alpha(theme.palette.status.needs_review.fill, 0.08)
          : 'transparent',
      })}
    >
      <Box className="flex items-center justify-between gap-2">
        {/* Named by this rather than by a duplicate `aria-label`: the text a
            person reads and the name a screen reader announces should be the
            same string, not two copies of it that can drift apart. */}
        <Typography id={labelId} variant="caption" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>

        {corrected ? (
          <Chip size="small" label="Corrected" sx={{ height: 20, fontSize: '0.7rem' }} />
        ) : needsAttention ? (
          <Typography variant="caption" sx={{ color: 'status.needs_review.ink' }}>
            Needs checking
          </Typography>
        ) : null}
      </Box>

      {children}
    </Box>
  );
}
