import type { ProcessingErrorCode } from '@/domain/errors';
import type { ProcessingStatus } from '@/domain/status';
import { toSearchParams } from '@/server/api-contract';

/**
 * Deep link from a batch figure into the documents it counts.
 *
 * Built with the same serializer the API query uses, so a link and the request
 * it produces cannot drift apart.
 */
export function batchDocumentsHref(batchId: string, status?: ProcessingStatus): string {
  const params = toSearchParams({ batchId, status: status ? [status] : undefined });
  return `/documents?${params.toString()}`;
}

/** Deep link into one cause of failure within a batch. */
export function batchFailureHref(batchId: string, code: ProcessingErrorCode): string {
  const params = toSearchParams({ batchId, status: ['failed'], errorCode: [code] });
  return `/documents?${params.toString()}`;
}

// Link to a batch's own monitor.
export function batchHref(batchId: string): string {
  return `/batches/${batchId}`;
}
