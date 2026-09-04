import {
  CONFIDENCE_BANDS,
  HIGH_CONFIDENCE,
  MEDIUM_CONFIDENCE,
  type ConfidenceBand,
} from '@/domain/confidence';
import { DOCUMENT_TYPES, type DocumentType } from '@/domain/document';
import { PROCESSING_ERROR_CODES, type ProcessingErrorCode } from '@/domain/errors';
import { PROCESSING_STATUSES, type ProcessingStatus } from '@/domain/status';
import type { ColumnStore } from './columnStore';
import { errorFromId } from './documentAt';
import type { Overlay } from './overlay';

/**
 * Only these two statuses have ever been through extraction, so only these have
 * a confidence that means anything. A pending or failed document is stored as
 * 0, which is honest for sorting and a lie in an average.
 */

export type ArchiveAnalytics = {
  total: number;
  byStatus: Record<ProcessingStatus, number>;
  byType: Record<DocumentType, number>;
  /** Failures only, keyed by cause. */
  byCause: Record<ProcessingErrorCode, number>;
  /** Extracted documents only. */
  byConfidence: Record<ConfidenceBand, number>;
  /** How many documents the confidence figures are actually about. */
  extracted: number;
  /** Mean confidence across `extracted`, or 0 when nothing has been extracted. */
  averageConfidence: number;
  /** Failed plus needs_review: the work an operator still has to do. */
  needsAttention: number;
};

function zeroed<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

/**
 * Everything the overview reports, in one pass over the columns.
 *
 * Six separate counts would be six full scans of 100,000 rows. The columns are
 * already the reason a query is cheap here; reading them once for all of it is
 * the same trick applied to the summary.
 */
export function analyzeArchive(store: ColumnStore, overlay: Overlay): ArchiveAnalytics {
  const byStatus = zeroed(PROCESSING_STATUSES);
  const byType = zeroed(DOCUMENT_TYPES);
  const byCause = zeroed(PROCESSING_ERROR_CODES);
  const byConfidence = zeroed(CONFIDENCE_BANDS);

  const { patches, touched } = overlay;
  let extracted = 0;
  let confidenceTotal = 0;
  let needsAttention = 0;

  for (let index = 0; index < store.size; index += 1) {
    const patch = touched[index] === 1 ? patches.get(index) : undefined;

    const status =
      patch?.status ?? (PROCESSING_STATUSES[store.statusId[index] as number] as ProcessingStatus);

    byStatus[status] += 1;
    byType[DOCUMENT_TYPES[store.docTypeId[index] as number] as DocumentType] += 1;

    if (status === 'failed' || status === 'needs_review') needsAttention += 1;

    if (status === 'failed') {
      // Read the way `summaryAt` reads it: a patch may have cleared the
      // generated error, and a retried document must not still count as its
      // old cause.
      const cause =
        patch?.errorCode === null
          ? undefined
          : (patch?.errorCode ?? errorFromId(store.errorId[index] as number));

      if (cause !== undefined) byCause[cause] += 1;
    }

    if (status === 'completed' || status === 'needs_review') {
      const confidence = store.confidence[index] as number;

      extracted += 1;
      confidenceTotal += confidence;
      // Compared against the thresholds rather than named per row, the same
      // way the filter reads a band.
      if (confidence >= HIGH_CONFIDENCE) byConfidence.high += 1;
      else if (confidence >= MEDIUM_CONFIDENCE) byConfidence.medium += 1;
      else byConfidence.low += 1;
    }
  }

  return {
    total: store.size,
    byStatus,
    byType,
    byCause,
    byConfidence,
    extracted,
    averageConfidence: extracted === 0 ? 0 : confidenceTotal / extracted,
    needsAttention,
  };
}
