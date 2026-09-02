'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

type TableSkeletonProps = {
  rows?: number;
  columns?: number;
};

// Placeholder shaped like the table it replaces, so nothing shifts when data lands.
export function TableSkeleton({ rows = 8, columns = 5 }: TableSkeletonProps) {
  return (
    <Box className="flex flex-col gap-2 p-4" aria-hidden>
      {Array.from({ length: rows }, (_, row) => (
        <Box key={row} className="flex items-center gap-4">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              variant="rounded"
              height={20}
              className="flex-1"
              sx={{ maxWidth: column === 0 ? 220 : undefined }}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}
