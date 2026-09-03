import { Suspense } from 'react';
import { TableSkeleton } from '@/components/feedback/TableSkeleton';
import { DocumentsView } from '@/features/documents/DocumentsView';

// useSearchParams needs a Suspense boundary, and the skeleton is what a reader
// sees while the client bundle arrives.
export default function DocumentsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
      <DocumentsView />
    </Suspense>
  );
}
