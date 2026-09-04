import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageSections } from '@/components/layout/PageSections';
import { LinkButton } from '@/components/ui/LinkButton';
import { AnalyticsPanel } from '@/features/overview/AnalyticsPanel';
import { ArchiveSummaryPanel } from '@/features/overview/ArchiveSummaryPanel';

export default function OverviewPage() {
  return (
    <PageSections>
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
      <AnalyticsPanel />
    </PageSections>
  );
}
