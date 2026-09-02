export type ConfidenceBand = 'high' | 'medium' | 'low';

export const HIGH_CONFIDENCE = 0.9;
export const MEDIUM_CONFIDENCE = 0.7;

// Buckets a raw confidence score into the three bands the UI reasons about.
export function confidenceBand(score: number): ConfidenceBand {
  if (score >= HIGH_CONFIDENCE) return 'high';
  if (score >= MEDIUM_CONFIDENCE) return 'medium';
  return 'low';
}

// Reports whether a value is uncertain enough that an operator should look at it.
export function isLowConfidence(score: number): boolean {
  return score < MEDIUM_CONFIDENCE;
}

// Renders a confidence score as a whole percentage.
export function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export const CONFIDENCE_BAND_LABELS: Record<ConfidenceBand, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};
