import { isLowConfidence } from './confidence';

export type FieldSource = 'ocr' | 'ml' | 'manual';

// Extraction is uncertain by nature, so every field carries its own confidence
// and provenance rather than the record carrying one score for everything.
export type ExtractedField<T> = {
  value?: T;
  confidence: number;
  source: FieldSource;
};

export const SOURCE_LABELS: Record<FieldSource, string> = {
  ocr: 'Read by OCR',
  ml: 'Inferred by model',
  manual: 'Entered by operator',
};

// Reports whether extraction produced nothing usable for a field.
export function isMissing<T>(field: ExtractedField<T>): boolean {
  return field.value === undefined || field.value === null || field.value === '';
}

// Reports whether a field is uncertain enough to put in front of an operator.
export function fieldNeedsReview<T>(field: ExtractedField<T>): boolean {
  if (field.source === 'manual') return false;
  return isMissing(field) || isLowConfidence(field.confidence);
}

// Replaces a field's value with one an operator typed, which is trusted absolutely.
export function correctField<T>(field: ExtractedField<T>, value: T): ExtractedField<T> {
  return { ...field, value, confidence: 1, source: 'manual' };
}
