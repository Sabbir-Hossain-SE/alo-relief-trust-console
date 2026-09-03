import { CONFIDENCE_BAND_LABELS, type ConfidenceBand } from '@/domain/confidence';
import { DOCUMENT_TYPE_LABELS, type DocumentType } from '@/domain/document';
import { describeError, type ProcessingErrorCode } from '@/domain/errors';
import type { ArchiveAnalytics } from '@/server/api-contract';
import type { BreakdownRow } from './components/BreakdownCard';
import { EXTRACTED_STATUSES, documentsHref } from './links';

const BANDS: readonly ConfidenceBand[] = ['high', 'medium', 'low'];

/**
 * How much of a row's bar to fill, measured against the largest row rather than
 * the total.
 *
 * These distributions are long-tailed: scaled against the total, six of seven
 * failure causes render as an invisible sliver and the card carries no shape at
 * all. The percentage printed beside the bar is still of the total, so the bar
 * is the comparison and the number is the fact.
 */
export function barShare(count: number, peak: number): number {
  return peak <= 0 ? 0 : Math.min(1, count / peak);
}

/** Largest first, since a breakdown is read to find where the weight is. */
function byCountDescending(a: BreakdownRow, b: BreakdownRow): number {
  return b.count - a.count || a.label.localeCompare(b.label);
}

/**
 * How certain the pipeline was, over the documents it actually read.
 *
 * Ordered by band rather than by count: high, medium and low are a scale, and
 * reordering a scale by size makes it harder to read, not easier.
 */
export function confidenceRows(analytics: ArchiveAnalytics): BreakdownRow[] {
  return BANDS.map((band) => ({
    key: band,
    label: CONFIDENCE_BAND_LABELS[band],
    count: analytics.byConfidence[band],
    href: documentsHref({ status: [...EXTRACTED_STATUSES], confidence: [band] }),
  }));
}

/** Why documents failed. Causes that never occurred are left out rather than listed as zero. */
export function failureRows(analytics: ArchiveAnalytics): BreakdownRow[] {
  return Object.entries(analytics.byCause)
    .filter(([, count]) => count > 0)
    .map(([code, count]) => ({
      key: code,
      label: describeError(code as ProcessingErrorCode).title,
      count,
      href: documentsHref({ status: ['failed'], errorCode: [code as ProcessingErrorCode] }),
    }))
    .sort(byCountDescending);
}

/** What kind of paper the archive is made of. */
export function typeRows(analytics: ArchiveAnalytics): BreakdownRow[] {
  return Object.entries(analytics.byType)
    .map(([type, count]) => ({
      key: type,
      label: DOCUMENT_TYPE_LABELS[type as DocumentType],
      count,
      href: documentsHref({ documentType: [type as DocumentType] }),
    }))
    .sort(byCountDescending);
}
