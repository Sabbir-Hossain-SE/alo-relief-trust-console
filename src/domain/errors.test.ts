import { describe, expect, it } from 'vitest';
import {
  PROCESSING_ERROR_CODES,
  describeError,
  isRetryable,
  retryableCodes,
  type ProcessingErrorCode,
} from './errors';

describe('describeError', () => {
  it('describes every code', () => {
    for (const code of PROCESSING_ERROR_CODES) {
      const spec = describeError(code);

      expect(spec.title.length).toBeGreaterThan(0);
      expect(spec.detail.length).toBeGreaterThan(0);
      expect(spec.remedy.length).toBeGreaterThan(0);
    }
  });

  it('never gives a generic failure message', () => {
    for (const code of PROCESSING_ERROR_CODES) {
      expect(describeError(code).title.toLowerCase()).not.toContain('something went wrong');
    }
  });
});

describe('isRetryable', () => {
  it('allows retry where a second attempt could succeed', () => {
    expect(isRetryable('ocr_timeout')).toBe(true);
    expect(isRetryable('network_error')).toBe(true);
    expect(isRetryable('low_text_density')).toBe(true);
  });

  it('refuses retry where the file itself is the problem', () => {
    expect(isRetryable('unsupported_format')).toBe(false);
    expect(isRetryable('file_too_large')).toBe(false);
    expect(isRetryable('password_protected')).toBe(false);
  });

  it('points non-retryable failures at something the operator can actually do', () => {
    const nonRetryable = PROCESSING_ERROR_CODES.filter((code) => !isRetryable(code));

    expect(nonRetryable.length).toBeGreaterThan(0);

    for (const code of nonRetryable) {
      expect(describeError(code).remedy.toLowerCase()).not.toContain('retry now');
    }
  });
});

describe('retryableCodes', () => {
  it('keeps only the codes worth retrying', () => {
    const mixed: ProcessingErrorCode[] = ['ocr_timeout', 'unsupported_format', 'network_error'];

    expect(retryableCodes(mixed)).toEqual(['ocr_timeout', 'network_error']);
  });

  it('returns nothing when every failure is terminal', () => {
    expect(retryableCodes(['unsupported_format', 'file_too_large'])).toEqual([]);
  });

  it('returns nothing for an empty list', () => {
    expect(retryableCodes([])).toEqual([]);
  });

  it('preserves order and duplicates so counts stay accurate', () => {
    const codes: ProcessingErrorCode[] = ['ocr_timeout', 'ocr_timeout', 'file_too_large'];

    expect(retryableCodes(codes)).toEqual(['ocr_timeout', 'ocr_timeout']);
  });
});
