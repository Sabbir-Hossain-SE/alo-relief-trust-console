// A single value pulled out of a document, paired with how sure the pipeline is
// about it. Kept generic so numeric and string fields share the same shape.
export type ExtractedField<T> = {
  value: T;
  // 0..1. The grid sorts and filters on the average of these.
  confidence: number;
  // Where the value came from, so low-confidence machine reads can be flagged
  // differently from operator-entered corrections.
  source: FieldSource;
};

export const FIELD_SOURCES = ['extracted', 'manual'] as const;

export type FieldSource = (typeof FIELD_SOURCES)[number];
