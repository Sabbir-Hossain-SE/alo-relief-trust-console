'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { STATUS_LABELS, type ProcessingStatus } from '@/domain/status';
import { formatCount } from '@/lib/format/number';

type StatCardProps = {
  status: ProcessingStatus;
  count: number;
  total: number;
};

// One slice of a batch's outcome, sized against the whole so the split is readable.
export function StatCard({ status, count, total }: StatCardProps) {
  const share = total > 0 ? count / total : 0;

  return (
    <Paper className="flex flex-col gap-2 p-4">
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {STATUS_LABELS[status]}
      </Typography>

      <Typography variant="h2" component="p" className="figures">
        {formatCount(count)}
      </Typography>

      <Box
        className="h-1 w-full overflow-hidden rounded-full"
        sx={(theme) => ({ backgroundColor: alpha(theme.palette.status[status].fill, 0.2) })}
      >
        <Box
          className="h-full rounded-full"
          sx={(theme) => ({
            width: `${Math.round(share * 100)}%`,
            // The bar reports a proportion, so it has to clear the contrast
            // threshold for meaningful graphics. Ink does; the tint does not.
            backgroundColor: theme.palette.status[status].ink,
          })}
        />
      </Box>
    </Paper>
  );
}
