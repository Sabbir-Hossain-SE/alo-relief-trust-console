import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from './apiError';

describe('apiErrorMessage', () => {
  it('says nothing when nothing failed', () => {
    expect(apiErrorMessage(undefined)).toBeUndefined();
  });

  it('carries the remedy, not only the cause', () => {
    const error = {
      data: { code: 'not_retryable', message: 'Format not supported.', remedy: 'Convert to PDF.' },
    };

    expect(apiErrorMessage(error)).toBe('Format not supported. Convert to PDF.');
  });

  it('uses the message alone when there is no remedy', () => {
    expect(apiErrorMessage({ data: { code: 'not_found', message: 'Gone.' } })).toBe('Gone.');
  });

  it('falls back to something actionable when the body is not ours', () => {
    // A network failure has no parsed body at all, and "undefined" on screen is
    // worse than a plain sentence.
    expect(apiErrorMessage({ status: 'FETCH_ERROR' })).toBe(
      'That request did not go through. Try again.',
    );
  });
});
