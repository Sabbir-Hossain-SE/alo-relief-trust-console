import { describe, expect, it } from 'vitest';
import {
  HIGH_CONFIDENCE,
  MEDIUM_CONFIDENCE,
  confidenceBand,
  formatConfidence,
  isLowConfidence,
} from './confidence';

describe('confidenceBand', () => {
  it('bands a certain value as high', () => {
    expect(confidenceBand(1)).toBe('high');
    expect(confidenceBand(0.95)).toBe('high');
  });

  it('bands a plausible but unverified value as medium', () => {
    expect(confidenceBand(0.85)).toBe('medium');
    expect(confidenceBand(0.7)).toBe('medium');
  });

  it('bands an unreliable value as low', () => {
    expect(confidenceBand(0.5)).toBe('low');
    expect(confidenceBand(0)).toBe('low');
  });

  it('treats each threshold as inclusive of the higher band', () => {
    expect(confidenceBand(HIGH_CONFIDENCE)).toBe('high');
    expect(confidenceBand(MEDIUM_CONFIDENCE)).toBe('medium');
  });

  it('drops a band just below each threshold', () => {
    expect(confidenceBand(HIGH_CONFIDENCE - 0.0001)).toBe('medium');
    expect(confidenceBand(MEDIUM_CONFIDENCE - 0.0001)).toBe('low');
  });
});

describe('isLowConfidence', () => {
  it('flags anything below the medium threshold', () => {
    expect(isLowConfidence(MEDIUM_CONFIDENCE - 0.0001)).toBe(true);
    expect(isLowConfidence(0.2)).toBe(true);
  });

  it('does not flag values at or above the medium threshold', () => {
    expect(isLowConfidence(MEDIUM_CONFIDENCE)).toBe(false);
    expect(isLowConfidence(0.99)).toBe(false);
  });

  it('agrees with the low band', () => {
    for (const score of [0, 0.33, 0.69, 0.7, 0.89, 0.9, 1]) {
      expect(isLowConfidence(score)).toBe(confidenceBand(score) === 'low');
    }
  });
});

describe('formatConfidence', () => {
  it('renders a whole percentage', () => {
    expect(formatConfidence(0.63)).toBe('63%');
    expect(formatConfidence(1)).toBe('100%');
    expect(formatConfidence(0)).toBe('0%');
  });

  it('rounds rather than truncating', () => {
    expect(formatConfidence(0.635)).toBe('64%');
    expect(formatConfidence(0.634)).toBe('63%');
  });
});
