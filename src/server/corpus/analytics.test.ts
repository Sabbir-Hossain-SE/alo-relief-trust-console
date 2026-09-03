import { describe, expect, it } from 'vitest';
import { confidenceBand } from '@/domain/confidence';
import { DOCUMENT_TYPES } from '@/domain/document';
import { PROCESSING_ERROR_CODES } from '@/domain/errors';
import { PROCESSING_STATUSES, type ProcessingStatus } from '@/domain/status';
import { analyzeArchive } from './analytics';
import { buildColumnStore } from './columnStore';
import { applyPatch, createOverlay } from './overlay';
import { countByStatus, filterIndices } from './query';

const SEED = 20260901;
const SIZE = 5000;
const store = buildColumnStore(SEED, SIZE);
const empty = createOverlay();

function statusOf(index: number): ProcessingStatus {
  return PROCESSING_STATUSES[store.statusId[index] as number] as ProcessingStatus;
}

function firstWithStatus(status: ProcessingStatus): number {
  for (let index = 0; index < SIZE; index += 1) {
    if (statusOf(index) === status) return index;
  }
  throw new Error(`No ${status} document in the sample`);
}

describe('analyzeArchive', () => {
  const analytics = analyzeArchive(store, empty);

  it('accounts for every document exactly once, per breakdown', () => {
    const sum = (counts: Record<string, number>) =>
      Object.values(counts).reduce((total, count) => total + count, 0);

    expect(analytics.total).toBe(SIZE);
    expect(sum(analytics.byStatus)).toBe(SIZE);
    expect(sum(analytics.byType)).toBe(SIZE);
  });

  // The overview and the summary endpoint would otherwise be able to disagree
  // about the same archive on the same screen.
  it('agrees with countByStatus', () => {
    expect(analytics.byStatus).toEqual(countByStatus(store, empty));
  });

  it('counts attention as the two statuses an operator has to act on', () => {
    expect(analytics.needsAttention).toBe(
      analytics.byStatus.failed + analytics.byStatus.needs_review,
    );
  });

  describe('confidence', () => {
    // A pending or failed document is stored at 0 confidence, which is honest
    // for sorting and a lie in an average.
    it('is reported over extracted documents only', () => {
      expect(analytics.extracted).toBe(
        analytics.byStatus.completed + analytics.byStatus.needs_review,
      );

      const banded = Object.values(analytics.byConfidence).reduce((sum, n) => sum + n, 0);
      expect(banded).toBe(analytics.extracted);
    });

    it('reports a mean the never-extracted cannot drag down', () => {
      const naive =
        Array.from({ length: SIZE }, (_, i) => store.confidence[i] as number).reduce(
          (sum, value) => sum + value,
          0,
        ) / SIZE;

      expect(analytics.averageConfidence).toBeGreaterThan(naive);
      expect(analytics.averageConfidence).toBeLessThanOrEqual(1);
    });

    // The tiles link into the grid, so a figure that does not match what the
    // filter returns sends an operator to the wrong screen.
    it('matches the filter its tile links to', () => {
      for (const band of ['high', 'medium', 'low'] as const) {
        const matching = filterIndices(store, empty, {
          status: ['completed', 'needs_review'],
          confidence: [band],
        });

        expect(analytics.byConfidence[band]).toBe(matching.length);
      }
    });
  });

  describe('failure causes', () => {
    it('counts only failures, and every one of them', () => {
      const total = Object.values(analytics.byCause).reduce((sum, count) => sum + count, 0);

      expect(total).toBe(analytics.byStatus.failed);
    });

    it('matches the filter its row links to', () => {
      for (const cause of PROCESSING_ERROR_CODES) {
        const matching = filterIndices(store, empty, { status: ['failed'], errorCode: [cause] });

        expect(analytics.byCause[cause]).toBe(matching.length);
      }
    });
  });

  it('names every type and every cause, so a zero is reported rather than absent', () => {
    for (const type of DOCUMENT_TYPES) expect(analytics.byType[type]).toBeGreaterThanOrEqual(0);
    for (const cause of PROCESSING_ERROR_CODES) {
      expect(analytics.byCause[cause]).toBeGreaterThanOrEqual(0);
    }
  });

  it('reports an empty archive without dividing by zero', () => {
    const result = analyzeArchive(buildColumnStore(SEED, 0), createOverlay());

    expect(result).toMatchObject({ total: 0, extracted: 0, averageConfidence: 0 });
  });
});

describe('analyzeArchive over the overlay', () => {
  it('follows a corrected document out of the review queue', () => {
    const overlay = createOverlay();
    const index = firstWithStatus('needs_review');
    const before = analyzeArchive(store, empty);

    applyPatch(overlay, index, { status: 'completed' });
    const after = analyzeArchive(store, overlay);

    expect(after.byStatus.needs_review).toBe(before.byStatus.needs_review - 1);
    expect(after.byStatus.completed).toBe(before.byStatus.completed + 1);
    expect(after.needsAttention).toBe(before.needsAttention - 1);
    // Still extracted, so the confidence figures are unmoved.
    expect(after.extracted).toBe(before.extracted);
    expect(after.byConfidence).toEqual(before.byConfidence);
  });

  it('stops counting a retried failure against its old cause', () => {
    const overlay = createOverlay();
    const index = firstWithStatus('failed');
    const cause = PROCESSING_ERROR_CODES[(store.errorId[index] as number) - 1];
    const before = analyzeArchive(store, empty);

    applyPatch(overlay, index, { status: 'completed', errorCode: null });
    const after = analyzeArchive(store, overlay);

    expect(cause).toBeDefined();
    expect(after.byCause[cause!]).toBe(before.byCause[cause!] - 1);
    expect(after.byStatus.failed).toBe(before.byStatus.failed - 1);
  });

  it('brings an uploaded document into the confidence figures once it extracts', () => {
    const overlay = createOverlay();
    const index = firstWithStatus('pending');
    const band = confidenceBand(store.confidence[index] as number);
    const before = analyzeArchive(store, empty);

    applyPatch(overlay, index, { status: 'completed' });
    const after = analyzeArchive(store, overlay);

    expect(after.extracted).toBe(before.extracted + 1);
    expect(after.byConfidence[band]).toBe(before.byConfidence[band] + 1);
  });
});
