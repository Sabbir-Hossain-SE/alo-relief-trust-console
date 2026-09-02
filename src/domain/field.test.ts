import { describe, expect, it } from 'vitest';
import { correctField, fieldNeedsReview, isMissing, type ExtractedField } from './field';

function field(overrides: Partial<ExtractedField<string>> = {}): ExtractedField<string> {
  return { value: 'Rahim Ahmed', confidence: 0.95, source: 'ocr', ...overrides };
}

describe('isMissing', () => {
  it('treats an absent value as missing', () => {
    expect(isMissing(field({ value: undefined }))).toBe(true);
  });

  it('treats an empty string as missing, since extraction found nothing usable', () => {
    expect(isMissing(field({ value: '' }))).toBe(true);
  });

  it('does not treat a present value as missing', () => {
    expect(isMissing(field())).toBe(false);
  });

  it('does not treat zero as missing', () => {
    const numeric: ExtractedField<number> = { value: 0, confidence: 0.9, source: 'ocr' };

    expect(isMissing(numeric)).toBe(false);
  });
});

describe('fieldNeedsReview', () => {
  it('flags a missing value', () => {
    expect(fieldNeedsReview(field({ value: undefined }))).toBe(true);
  });

  it('flags a value the pipeline was unsure about', () => {
    expect(fieldNeedsReview(field({ confidence: 0.4 }))).toBe(true);
  });

  it('does not flag a confident value', () => {
    expect(fieldNeedsReview(field({ confidence: 0.95 }))).toBe(false);
  });

  it('trusts an operator absolutely, even on a value that was uncertain', () => {
    expect(fieldNeedsReview(field({ confidence: 0.1, source: 'manual' }))).toBe(false);
  });

  it('trusts an operator who deliberately left a field blank', () => {
    expect(fieldNeedsReview(field({ value: '', source: 'manual' }))).toBe(false);
  });
});

describe('correctField', () => {
  it('replaces the value with what the operator typed', () => {
    expect(correctField(field({ value: 'Rahim Ahmd' }), 'Rahim Ahmed').value).toBe('Rahim Ahmed');
  });

  it('marks the value as certain and operator-sourced', () => {
    const corrected = correctField(field({ confidence: 0.31 }), 'Rahim Ahmed');

    expect(corrected.confidence).toBe(1);
    expect(corrected.source).toBe('manual');
  });

  it('takes a corrected field out of review', () => {
    const corrected = correctField(field({ value: undefined, confidence: 0 }), 'Rahim Ahmed');

    expect(fieldNeedsReview(corrected)).toBe(false);
  });

  it('does not mutate the original field', () => {
    const original = field({ value: 'Rahim Ahmd', confidence: 0.4 });
    correctField(original, 'Rahim Ahmed');

    expect(original.value).toBe('Rahim Ahmd');
    expect(original.confidence).toBe(0.4);
    expect(original.source).toBe('ocr');
  });
});
