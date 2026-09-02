import { describe, expect, it } from 'vitest';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, overallConfidence } from './document';
import type { NormalizedRecord } from './document';
import type { ExtractedField } from './field';

function at(confidence: number): ExtractedField<string> {
  return { value: 'x', confidence, source: 'ocr' };
}

function record(confidences: number[]): NormalizedRecord {
  const [personName, phone, location, programName, documentDate] = confidences.map(at);

  return {
    personName: personName as ExtractedField<string>,
    phone: phone as ExtractedField<string>,
    location: location as ExtractedField<string>,
    programName: programName as ExtractedField<string>,
    documentDate: documentDate as ExtractedField<string>,
  };
}

describe('overallConfidence', () => {
  it('averages the field confidences', () => {
    expect(overallConfidence(record([1, 1, 1, 1, 1]))).toBe(1);
    expect(overallConfidence(record([0, 0, 0, 0, 0]))).toBe(0);
  });

  it('is dragged down by a single uncertain field', () => {
    const clean = overallConfidence(record([1, 1, 1, 1, 1]));
    const oneBad = overallConfidence(record([1, 1, 1, 1, 0]));

    expect(oneBad).toBeLessThan(clean);
    expect(oneBad).toBeCloseTo(0.8, 5);
  });

  it('stays within the unit interval', () => {
    const score = overallConfidence(record([0.1, 0.44, 0.9, 0.72, 0.31]));

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('document types', () => {
  it('labels every type', () => {
    for (const type of DOCUMENT_TYPES) {
      expect(DOCUMENT_TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it('covers the kinds of paper named in the brief', () => {
    expect(DOCUMENT_TYPES).toContain('enrollment_form');
    expect(DOCUMENT_TYPES).toContain('medical_intake');
    expect(DOCUMENT_TYPES).toContain('id_scan');
    expect(DOCUMENT_TYPES).toContain('handwritten_note');
  });
});
