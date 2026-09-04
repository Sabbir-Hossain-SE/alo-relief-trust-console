import { describe, expect, it } from 'vitest';
import { ROW_HEIGHT, gridHeight, visibleRows } from './DocumentsGrid';

const DENSITIES = ['comfortable', 'compact'] as const;

describe('gridHeight', () => {
  /**
   * The bug this exists for: a fixed height cuts the last row in half wherever
   * it happens to land, which reads as a rendering fault rather than as a
   * scroll affordance. It also moves with the density toggle, so it cannot be
   * corrected with one number.
   */
  it('shows a whole number of rows at every density', () => {
    for (const density of DENSITIES) {
      const rowHeight = ROW_HEIGHT[density];
      const rows = visibleRows(gridHeight(rowHeight), rowHeight);

      expect(rows, density).toBe(Math.round(rows));
    }
  });

  it('shows enough rows to be worth scrolling', () => {
    for (const density of DENSITIES) {
      const rowHeight = ROW_HEIGHT[density];

      expect(visibleRows(gridHeight(rowHeight), rowHeight)).toBeGreaterThanOrEqual(8);
    }
  });

  // The denser setting is the one an operator picks to see more at once.
  it('fits more rows into a comparable height when rows are shorter', () => {
    const comfortable = visibleRows(gridHeight(ROW_HEIGHT.comfortable), ROW_HEIGHT.comfortable);
    const compact = visibleRows(gridHeight(ROW_HEIGHT.compact), ROW_HEIGHT.compact);

    expect(compact).toBeGreaterThan(comfortable);
    expect(
      Math.abs(gridHeight(ROW_HEIGHT.compact) - gridHeight(ROW_HEIGHT.comfortable)),
    ).toBeLessThan(ROW_HEIGHT.compact);
  });

  // A row height nothing divides evenly must still not produce a half row.
  it('holds for a row height that divides nothing evenly', () => {
    expect(visibleRows(gridHeight(37), 37)).toBe(Math.round(visibleRows(gridHeight(37), 37)));
  });

  it('never collapses to fewer than four rows', () => {
    expect(visibleRows(gridHeight(400), 400)).toBe(4);
  });
});
