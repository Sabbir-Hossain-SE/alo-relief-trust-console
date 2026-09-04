import { describe, expect, it } from 'vitest';
import { isStorablePhone } from '@/lib/phone/phone';
import { NORMALIZED_FIELD_KEYS } from '@/domain/document';
import { isMissing } from '@/domain/field';
import { PROCESSING_STATUSES, type ProcessingStatus } from '@/domain/status';
import { buildColumnStore } from './columnStore';
import { detailAt, documentId, indexFromId, summaryAt } from './documentAt';
import { generateCore } from './generate';
import { applyPatch, createOverlay } from './overlay';
import { NAME_POOL } from './pools.generated';

const SEED = 20260901;
const store = buildColumnStore(SEED, 5000);
const empty = createOverlay();

function firstWithStatus(status: ProcessingStatus): number {
  for (let index = 0; index < store.size; index += 1) {
    if (PROCESSING_STATUSES[store.statusId[index] as number] === status) return index;
  }

  throw new Error(`No ${status} document in the sample`);
}

describe('documentId', () => {
  it('pads to a fixed width so ids sort lexically', () => {
    expect(documentId(0)).toBe('ARC-000000');
    expect(documentId(42)).toBe('ARC-000042');
    expect(documentId(99_999)).toBe('ARC-099999');
  });

  it('does not truncate beyond the padded width', () => {
    expect(documentId(1_234_567)).toBe('ARC-1234567');
  });

  it('round-trips through indexFromId', () => {
    for (const index of [0, 1, 42, 99_999, 1_234_567]) {
      expect(indexFromId(documentId(index))).toBe(index);
    }
  });

  it('rejects identifiers that are not ours', () => {
    for (const id of ['', 'ARC-', 'ARC-12', 'DOC-000042', 'ARC-00004a', 'arc-000042', '000042']) {
      expect(indexFromId(id)).toBeNull();
    }
  });
});

describe('summaryAt', () => {
  it('refuses an index outside the archive', () => {
    expect(() => summaryAt(store, empty, -1)).toThrow(RangeError);
    expect(() => summaryAt(store, empty, store.size)).toThrow(RangeError);
  });

  it('reads the row the store holds', () => {
    const summary = summaryAt(store, empty, 12);
    const core = generateCore(SEED, 12);

    expect(summary.index).toBe(12);
    expect(summary.id).toBe('ARC-000012');
    expect(summary.uploadedAt).toBe(core.uploadedAt);
    expect(PROCESSING_STATUSES.indexOf(summary.status)).toBe(core.statusId);
  });

  it('shows extracted values only where extraction happened', () => {
    for (let index = 0; index < 2000; index += 1) {
      const summary = summaryAt(store, empty, index);
      const extracted = summary.status === 'completed' || summary.status === 'needs_review';

      expect(summary.personName === undefined).toBe(!extracted);
      expect(summary.location === undefined).toBe(!extracted);
    }
  });

  it('carries an error code only on failures', () => {
    for (let index = 0; index < 2000; index += 1) {
      const summary = summaryAt(store, empty, index);

      if (summary.status === 'failed') expect(summary.errorCode).toBeDefined();
      else expect(summary.errorCode).toBeUndefined();
    }
  });

  it('lets a retry override the generated status and attempts', () => {
    const index = firstWithStatus('failed');
    const overlay = createOverlay();
    applyPatch(overlay, index, { status: 'processing', attempts: 2, errorCode: null });

    const summary = summaryAt(store, overlay, index);
    expect(summary.status).toBe('processing');
    expect(summary.attempts).toBe(2);
    expect(summary.errorCode).toBeUndefined();
  });

  it('leaves other documents untouched when one is patched', () => {
    const index = firstWithStatus('failed');
    const overlay = createOverlay();
    applyPatch(overlay, index, { status: 'completed' });

    const neighbour = index + 1;
    expect(summaryAt(store, overlay, neighbour)).toEqual(summaryAt(store, empty, neighbour));
  });

  it('names files with a real extension', () => {
    for (let index = 0; index < 500; index += 1) {
      expect(summaryAt(store, empty, index).fileName).toMatch(
        /^[a-z_]+-\d{6}\.(pdf|jpg|png|tiff)$/,
      );
    }
  });
});

describe('detailAt', () => {
  it('agrees with the summary it extends', () => {
    const detail = detailAt(store, empty, 12);
    const summary = summaryAt(store, empty, 12);

    expect(detail.id).toBe(summary.id);
    expect(detail.status).toBe(summary.status);
    expect(detail.confidence).toBe(summary.confidence);
  });

  it('returns every normalized field, present or not', () => {
    const detail = detailAt(store, empty, firstWithStatus('needs_review'));

    for (const key of NORMALIZED_FIELD_KEYS) {
      expect(detail.fields[key]).toBeDefined();
      expect(typeof detail.fields[key].confidence).toBe('number');
    }
  });

  it('fills every field on a completed document', () => {
    const detail = detailAt(store, empty, firstWithStatus('completed'));

    for (const key of NORMALIZED_FIELD_KEYS) {
      expect(isMissing(detail.fields[key])).toBe(false);
    }

    expect(NAME_POOL).toContain(detail.fields.personName.value);
  });

  it('leaves every field empty on a failed document', () => {
    const detail = detailAt(store, empty, firstWithStatus('failed'));

    for (const key of NORMALIZED_FIELD_KEYS) {
      expect(isMissing(detail.fields[key])).toBe(true);
    }
  });

  it('starts with no corrections recorded', () => {
    expect(detailAt(store, empty, 12).corrections).toEqual([]);
  });

  it('prefers an operator correction over the generated value', () => {
    const index = firstWithStatus('needs_review');
    const overlay = createOverlay();

    applyPatch(overlay, index, {
      fields: { personName: { value: 'Corrected Name', confidence: 1, source: 'manual' } },
      corrections: [{ field: 'personName', next: 'Corrected Name', correctedAt: 1 }],
    });

    const detail = detailAt(store, overlay, index);
    expect(detail.fields.personName.value).toBe('Corrected Name');
    expect(detail.fields.personName.source).toBe('manual');
    expect(detail.corrections).toHaveLength(1);
  });

  it('leaves fields the operator did not touch alone', () => {
    const index = firstWithStatus('needs_review');
    const overlay = createOverlay();
    const before = detailAt(store, empty, index);

    applyPatch(overlay, index, {
      fields: { personName: { value: 'Corrected Name', confidence: 1, source: 'manual' } },
    });

    const after = detailAt(store, overlay, index);
    expect(after.fields.location).toEqual(before.fields.location);
    expect(after.fields.phone).toEqual(before.fields.phone);
  });

  it('generates phone numbers the numbering plan allows', () => {
    // Shape alone is not the assertion worth making: the archive used to
    // produce +8801 followed by eight digits, which matches nothing a network
    // would route and which the correction form now rejects on sight.
    const values = Array.from({ length: 400 }, (_, index) =>
      String(detailAt(store, empty, index).fields.phone.value ?? ''),
    );

    for (const [index, value] of values.entries()) {
      expect(isStorablePhone(value), `${index} produced ${value}`).toBe(true);
    }

    // Extraction leaves some records without a phone at all, so a suite that
    // only asserted "nothing invalid" could pass on an archive of blanks.
    expect(values.filter((value) => value !== '').length).toBeGreaterThan(200);
  });

  it('dates the document on or before its upload', () => {
    const index = firstWithStatus('completed');
    const detail = detailAt(store, empty, index);
    const documentDate = new Date(`${detail.fields.documentDate.value}T00:00:00Z`).getTime();

    expect(documentDate).toBeLessThanOrEqual(detail.uploadedAt);
  });

  it('reads the same detail every time', () => {
    expect(detailAt(store, empty, 77)).toEqual(detailAt(store, empty, 77));
  });
});

describe('summaryAt over a corrected record', () => {
  /**
   * The grid, the review queue and the CSV export all read a summary while the
   * drawer reads a detail. When only the detail applied corrections, a record
   * an operator had just fixed still showed the pipeline's value in the row
   * behind the drawer they fixed it in.
   */
  it('shows the corrected value, not the generated one', () => {
    const overlay = createOverlay();
    const index = firstWithStatus('needs_review');
    const generated = summaryAt(store, empty, index);

    applyPatch(overlay, index, {
      fields: { personName: { value: 'Rahima Khatun', confidence: 1, source: 'manual' } },
    });

    expect(generated.personName).not.toBe('Rahima Khatun');
    expect(summaryAt(store, overlay, index).personName).toBe('Rahima Khatun');
  });

  it('agrees with the detail view of the same document', () => {
    const overlay = createOverlay();
    const index = firstWithStatus('needs_review');

    applyPatch(overlay, index, {
      fields: { location: { value: 'Cox\u2019s Bazar', confidence: 1, source: 'manual' } },
    });

    const summary = summaryAt(store, overlay, index);
    const detail = detailAt(store, overlay, index);

    expect(summary.location).toBe(detail.fields.location.value);
  });

  // Clearing a field is a claim that the page holds nothing there, which is a
  // different statement from never having corrected it.
  it('keeps a field an operator cleared cleared', () => {
    const overlay = createOverlay();
    const index = firstWithStatus('needs_review');

    applyPatch(overlay, index, {
      fields: { personName: { confidence: 1, source: 'manual' } },
    });

    expect(summaryAt(store, overlay, index).personName).toBeUndefined();
  });

  it('leaves an uncorrected field on the generated value', () => {
    const overlay = createOverlay();
    const index = firstWithStatus('needs_review');

    applyPatch(overlay, index, {
      fields: { personName: { value: 'Rahima Khatun', confidence: 1, source: 'manual' } },
    });

    expect(summaryAt(store, overlay, index).location).toBe(summaryAt(store, empty, index).location);
  });
});
