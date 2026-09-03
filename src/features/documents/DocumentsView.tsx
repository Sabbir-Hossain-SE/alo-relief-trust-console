'use client';

import Box from '@mui/material/Box';
import { PageHeader } from '@/components/layout/PageHeader';
import { DensityToggle } from './components/DensityToggle';
import { DocumentFilters } from './components/DocumentFilters';
import { DocumentsGrid } from './components/DocumentsGrid';
import { useDocumentQuery } from './useDocumentQuery';

export function DocumentsView() {
  const { query, update, clear, isFiltered } = useDocumentQuery();

  return (
    <>
      <PageHeader
        title="Documents"
        description="Every document in the archive, filterable and shareable by URL."
        actions={<DensityToggle />}
      />

      <Box>
        <DocumentFilters query={query} isFiltered={isFiltered} onChange={update} onClear={clear} />
        <DocumentsGrid />
      </Box>
    </>
  );
}
