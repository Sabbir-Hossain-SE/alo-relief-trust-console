import { describe, expect, it } from 'vitest';
import { buildColumnStore } from '@/server/corpus/columnStore';
import { analyzeArchive } from '@/server/corpus/analytics';
import { createOverlay } from '@/server/corpus/overlay';
import { fromSearchParams } from '@/server/api-contract';
import { filterIndices } from '@/server/corpus/query';
import { barShare, confidenceRows, failureRows, typeRows } from './breakdowns';

const store = buildColumnStore(20260901, 3000);
const overlay = createOverlay();
const analytics = analyzeArchive(store, overlay);

/** Re-runs a row's link through the query engine, the way the grid will. */
function rowsBehind(href: string): number {
  const query = fromSearchParams(new URL(href, 'http://localhost').searchParams);
  return filterIndices(store, overlay, query).length;
}

describe('confidenceRows', () => {
  it('keeps the bands in scale order rather than by size', () => {
    expect(confidenceRows(analytics).map((row) => row.key)).toEqual(['high', 'medium', 'low']);
  });

  /**
   * A confidence filter on its own also matches every pending and failed
   * document, stored at zero and so landing in the low band. Without the status
   * restriction, clicking "Low confidence: 8,000" opened a grid of 30,000.
   */
  it('links to a grid holding exactly the documents it counted', () => {
    for (const row of confidenceRows(analytics)) {
      expect(rowsBehind(row.href)).toBe(row.count);
    }
  });
});

describe('failureRows', () => {
  it('puts the commonest cause first', () => {
    const counts = failureRows(analytics).map((row) => row.count);

    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  // A cause that has never occurred is not information; it is a row of zero
  // that pushes the ones that matter off the card.
  it('leaves out causes that never occurred', () => {
    expect(failureRows(analytics).every((row) => row.count > 0)).toBe(true);
  });

  it('names the cause rather than showing its code', () => {
    expect(failureRows(analytics).every((row) => !/^[a-z_]+$/.test(row.label))).toBe(true);
  });

  it('links to a grid holding exactly the documents it counted', () => {
    for (const row of failureRows(analytics)) {
      expect(rowsBehind(row.href)).toBe(row.count);
    }
  });

  it('accounts for every failure', () => {
    const total = failureRows(analytics).reduce((sum, row) => sum + row.count, 0);

    expect(total).toBe(analytics.byStatus.failed);
  });
});

describe('typeRows', () => {
  it('accounts for the whole archive', () => {
    const total = typeRows(analytics).reduce((sum, row) => sum + row.count, 0);

    expect(total).toBe(analytics.total);
  });

  it('links to a grid holding exactly the documents it counted', () => {
    for (const row of typeRows(analytics)) {
      expect(rowsBehind(row.href)).toBe(row.count);
    }
  });
});

describe('barShare', () => {
  it('fills the largest row completely', () => {
    expect(barShare(3200, 3200)).toBe(1);
  });

  it('scales the rest against it', () => {
    expect(barShare(800, 3200)).toBe(0.25);
  });

  // The alternative is a division by zero rendered as a NaN width, which drops
  // the bar out of the layout rather than showing an empty one.
  it('reports nothing to fill when there is no peak', () => {
    expect(barShare(0, 0)).toBe(0);
  });

  it('never overflows its track', () => {
    expect(barShare(10, 5)).toBe(1);
  });
});
