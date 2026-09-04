'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { formatConfidence } from '@/domain/confidence';
import { ErrorState } from '@/components/feedback/ErrorState';
import { formatCount } from '@/lib/format/number';
import { SECTION_CONTENT_GAP } from '@/components/layout/PageSections';
import { useAnalytics } from '@/store/polling';
import { BreakdownCard } from './components/BreakdownCard';
import { confidenceRows, failureRows, typeRows } from './breakdowns';

const GRID = 'grid grid-cols-1 gap-4 lg:grid-cols-3';

/**
 * The three questions the counts above cannot answer: how certain the pipeline
 * was, why documents failed, and what the archive is made of.
 *
 * Every figure is a link into the documents behind it. A breakdown an operator
 * can only look at tells them where the work is and then makes them go and find
 * it by hand.
 */
export function AnalyticsPanel() {
  const { data, isLoading, isError, refetch } = useAnalytics();

  const heading = (
    <Typography variant="h2" component="h2">
      Archive breakdown
    </Typography>
  );

  if (isError) {
    return (
      <Box className={SECTION_CONTENT_GAP}>
        {heading}
        <ErrorState
          title="The archive breakdown could not be read"
          description="The counts above are still current; only this analysis did not come back."
          onRetry={() => void refetch()}
        />
      </Box>
    );
  }

  if (isLoading || data === undefined) {
    return (
      <Box className={SECTION_CONTENT_GAP}>
        {heading}
        <Skeleton variant="text" width={320} />
        <Box className={GRID}>
          {[0, 1, 2].map((card) => (
            <Skeleton key={card} variant="rounded" height={280} />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box className={SECTION_CONTENT_GAP}>
      {heading}

      {/* The one figure that names the work still outstanding. */}
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {formatCount(data.needsAttention)} of {formatCount(data.total)} documents still need someone
        to look at them.
      </Typography>

      <Box className={GRID}>
        <BreakdownCard
          title="Confidence"
          // Named rather than implied: a pending or failed document is stored at
          // zero confidence, and averaging those in would report the archive as
          // far less certain than the pipeline actually was.
          caption={`Across ${formatCount(data.extracted)} extracted documents · average ${formatConfidence(data.averageConfidence)}`}
          rows={confidenceRows(data)}
          total={data.extracted}
          emptyMessage="Nothing has been extracted yet."
        />

        <BreakdownCard
          title="Why documents fail"
          caption={`${formatCount(data.byStatus.failed)} failures · not all of them worth retrying`}
          rows={failureRows(data)}
          total={data.byStatus.failed}
          emptyMessage="No document in the archive has failed."
        />

        <BreakdownCard
          title="Documents by type"
          caption={`${formatCount(data.total)} documents in the archive`}
          rows={typeRows(data)}
          total={data.total}
          emptyMessage="The archive is empty."
        />
      </Box>
    </Box>
  );
}
