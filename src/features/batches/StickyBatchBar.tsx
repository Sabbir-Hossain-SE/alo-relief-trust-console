'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { formatCount } from '@/lib/format/number';
import { useMockApiReady } from '@/server/MockApiProvider';
import { useBatches } from '@/store/polling';
import { BatchProgressBar } from './components/BatchProgressBar';
import { batchHref } from './links';
import { batchProgress, remainingLabel, throughputLabel } from './progress';

/**
 * Keeps a running batch in view wherever the operator goes.
 *
 * Mounted in the shell rather than on a page, because the point is precisely
 * that navigating away does not lose the thread. It carries no live region: the
 * monitor page announces progress, and two regions describing the same batch
 * would talk over each other.
 */
export function StickyBatchBar() {
  // The shell renders before the mock backend is intercepting. Asking now would
  // fall through the service worker and come back a real 404, so the hook is
  // held behind this rather than fired and discarded.
  return useMockApiReady() ? <RunningBatchBar /> : null;
}

function RunningBatchBar() {
  const pathname = usePathname();
  const { data } = useBatches();

  const running = data?.filter((batch) => !batch.settled) ?? [];
  const current = running[0];

  // Redundant anywhere batch progress is already the subject of the page.
  if (current === undefined || pathname.startsWith('/batches')) return null;

  const { finished, total } = batchProgress(current);
  const detail = [throughputLabel(current.throughput), remainingLabel(current)].filter(
    (part) => part !== null,
  );

  return (
    <Paper
      component={Link}
      href={batchHref(current.id)}
      square
      elevation={0}
      aria-label={`${current.label} is processing — open the batch`}
      className="sticky bottom-0 z-10 flex flex-col gap-2 border-x-0 border-b-0 px-4 py-3 md:px-8"
      sx={{ textDecoration: 'none', color: 'inherit' }}
    >
      <Box className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Typography variant="body2" className="min-w-0 truncate font-semibold">
          {current.label}
          {running.length > 1 ? ` · ${formatCount(running.length - 1)} more running` : ''}
        </Typography>

        <Typography variant="caption" className="figures" sx={{ color: 'text.secondary' }}>
          {formatCount(finished)} of {formatCount(total)}
          {detail.length > 0 ? ` · ${detail.join(' · ')}` : ''}
        </Typography>
      </Box>

      <BatchProgressBar summary={current} height={4} />
    </Paper>
  );
}
