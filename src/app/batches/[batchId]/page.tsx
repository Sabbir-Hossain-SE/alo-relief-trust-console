import { BatchMonitorView } from '@/features/batches/BatchMonitorView';

type BatchPageProps = { params: Promise<{ batchId: string }> };

export default async function BatchPage({ params }: BatchPageProps) {
  const { batchId } = await params;

  return <BatchMonitorView batchId={batchId} />;
}
