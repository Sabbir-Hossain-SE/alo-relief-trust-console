'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

type StateViewProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: 'neutral' | 'error';
};

// Shared shell for the empty, error and no-results states so they stay consistent.
export function StateView({ icon, title, description, action, tone = 'neutral' }: StateViewProps) {
  return (
    <Box
      className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center"
      role={tone === 'error' ? 'alert' : undefined}
    >
      {icon ? (
        <Box sx={{ color: tone === 'error' ? 'status.failed' : 'text.disabled', fontSize: 40 }}>
          {icon}
        </Box>
      ) : null}

      <Typography variant="h3" component="h2">
        {title}
      </Typography>

      {description ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420 }}>
          {description}
        </Typography>
      ) : null}

      {action ? <Box className="mt-2">{action}</Box> : null}
    </Box>
  );
}
