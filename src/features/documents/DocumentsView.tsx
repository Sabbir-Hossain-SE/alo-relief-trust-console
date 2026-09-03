'use client';

import Box from '@mui/material/Box';
import { PageHeader } from '@/components/layout/PageHeader';
import { DensityToggle } from './components/DensityToggle';
import { DocumentFilters } from './components/DocumentFilters';
import { DocumentDrawer } from './components/DocumentDrawer';
import { DocumentsGrid } from './components/DocumentsGrid';
import { ExportButton } from './components/ExportButton';
import { ExportProgress } from './components/ExportProgress';
import { useCsvExport } from './useCsvExport';
import { useDocumentQuery } from './useDocumentQuery';

export function DocumentsView() {
  const { query, update, clear, isFiltered, selectedId, select } = useDocumentQuery();
  const { state, start, cancel } = useCsvExport();

  return (
    <>
      <PageHeader
        title="Documents"
        description="Every document in the archive, filterable and shareable by URL."
        actions={
          <>
            <ExportButton state={state} onStart={() => void start(query)} onCancel={cancel} />
            <DensityToggle />
          </>
        }
      />

      <Box>
        <DocumentFilters query={query} isFiltered={isFiltered} onChange={update} onClear={clear} />
        <ExportProgress state={state} />
        <DocumentsGrid onOpen={(row) => select(row.id)} />
      </Box>

      <DocumentDrawer documentId={selectedId} onClose={() => select(null)} />
    </>
  );
}
