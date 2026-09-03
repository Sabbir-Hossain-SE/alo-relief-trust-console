'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { describeError } from '@/domain/errors';
import { formatCount } from '@/lib/format/number';
import type { FailureGroup } from '@/server/simulator/batch';
import { batchFailureHref } from '../links';

// One cause of failure, its count, and what can actually be done about it.
export function FailureCause({ batchId, group }: { batchId: string; group: FailureGroup }) {
  const spec = describeError(group.code);

  return (
    <Box
      component={Link}
      href={batchFailureHref(batchId, group.code)}
      className="flex items-baseline gap-3 rounded-lg px-3 py-2"
      sx={{
        textDecoration: 'none',
        color: 'inherit',
        '&:hover': { backgroundColor: 'action.hover' },
      }}
    >
      <Typography
        variant="body2"
        className="figures w-10 shrink-0 text-right font-semibold"
        sx={{ color: 'status.failed.ink' }}
      >
        {formatCount(group.count)}
      </Typography>

      <Box className="min-w-0">
        <Typography variant="body2">{spec.title}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {group.retryable ? spec.remedy : `Cannot be retried. ${spec.remedy}`}
        </Typography>
      </Box>
    </Box>
  );
}
