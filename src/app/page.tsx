import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/data/StatCard';
import { PROCESSING_STATUSES } from '@/domain/status';
import { formatCount } from '@/lib/format/number';

// Placeholder until the mock API lands; the shape matches what it will return.
const SUMMARY = {
  total: 100_000,
  byStatus: {
    pending: 12_480,
    processing: 640,
    completed: 82_910,
    failed: 2_170,
    needs_review: 1_800,
  },
} as const;

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="The state of the Alo Relief Trust archive as it moves through digitization."
        actions={
          <LinkButton href="/upload" variant="contained" startIcon={<CloudUploadOutlinedIcon />}>
            Upload documents
          </LinkButton>
        }
      />

      <Paper className="mb-6 p-6">
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Documents in the archive
        </Typography>
        <Typography variant="h1" component="p" className="figures" sx={{ mt: 0.5 }}>
          {formatCount(SUMMARY.total)}
        </Typography>
      </Paper>

      <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {PROCESSING_STATUSES.map((status) => (
          <StatCard
            key={status}
            status={status}
            count={SUMMARY.byStatus[status]}
            total={SUMMARY.total}
          />
        ))}
      </Box>
    </>
  );
}
