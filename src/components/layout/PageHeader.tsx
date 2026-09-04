import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

// Page title block, with room for the primary actions of the screen.
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Box className="flex flex-wrap items-start justify-between gap-4">
      <Box className="min-w-0">
        <Typography variant="h1" component="h1">
          {title}
        </Typography>
        {description ? (
          <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 640 }}>
            {description}
          </Typography>
        ) : null}
      </Box>

      {actions ? <Box className="flex items-center gap-2">{actions}</Box> : null}
    </Box>
  );
}
