import Box from '@mui/material/Box';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { PageHeader } from '@/components/layout/PageHeader';
import { LinkButton } from '@/components/ui/LinkButton';
import { AnalyticsPanel } from '@/features/overview/AnalyticsPanel';
import { ArchiveSummaryPanel } from '@/features/overview/ArchiveSummaryPanel';

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

      <ArchiveSummaryPanel />

      <Box className="mt-8">
        <AnalyticsPanel />
      </Box>
    </>
  );
}
