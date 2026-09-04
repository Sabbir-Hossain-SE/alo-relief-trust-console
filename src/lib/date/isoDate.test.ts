import { describe, expect, it } from 'vitest';
import {
  DATE_PROBLEM_MESSAGES,
  EARLIEST_DOCUMENT_DATE,
  documentDateMessage,
  documentDateProblem,
  epochOfIsoDate,
  isRealDate,
} from './isoDate';

const NOW = Date.UTC(2026, 8, 4);

describe('isRealDate', () => {
  it('accepts a day that exists', () => {
    expect(isRealDate('2024-03-18')).toBe(true);
    expect(isRealDate('2024-02-29')).toBe(true);
  });

  it('rejects a day the calendar does not have', () => {
    expect(isRealDate('2024-02-31')).toBe(false);
    expect(isRealDate('2023-02-29')).toBe(false);
    expect(isRealDate('2024-13-01')).toBe(false);
  });

  it('rejects text that is not a date at all', () => {
    expect(isRealDate('yesterday')).toBe(false);
  });
});

describe('documentDateProblem', () => {
  it('finds nothing wrong with an ordinary past date', () => {
    expect(documentDateProblem('2024-03-18', NOW)).toBeNull();
  });

  it('finds nothing wrong with empty, because a scan may carry no date', () => {
    expect(documentDateProblem('', NOW)).toBeNull();
  });

  it('reports the form before the content', () => {
    expect(documentDateProblem('18/03/2024', NOW)).toBe('malformed');
    expect(documentDateProblem('2024-3-8', NOW)).toBe('malformed');
  });

  it('reports a day that does not exist', () => {
    expect(documentDateProblem('2024-02-31', NOW)).toBe('impossible');
  });

  it('reports a year that is almost certainly a typo', () => {
    expect(documentDateProblem('0024-03-18', NOW)).toBe('too-early');
    expect(documentDateProblem('1899-12-31', NOW)).toBe('too-early');
    expect(documentDateProblem(EARLIEST_DOCUMENT_DATE, NOW)).toBeNull();
  });

  it('reports a date the document could not have been filed on yet', () => {
    expect(documentDateProblem('2026-09-05', NOW)).toBe('future');
    expect(documentDateProblem('2026-09-04', NOW)).toBeNull();
  });

  it('reads today from the clock when it is not told otherwise', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(documentDateProblem(tomorrow)).toBe('future');
  });
});

describe('documentDateMessage', () => {
  it('turns a problem into the sentence an operator reads', () => {
    expect(documentDateMessage('2024-02-31', NOW)).toBe(DATE_PROBLEM_MESSAGES.impossible);
    expect(documentDateMessage('2026-09-05', NOW)).toBe(DATE_PROBLEM_MESSAGES.future);
  });

  it('says nothing when nothing is wrong', () => {
    expect(documentDateMessage('2024-03-18', NOW)).toBeNull();
  });

  it('names the floor it is enforcing rather than only refusing', () => {
    expect(documentDateMessage('1800-01-01', NOW)).toContain(EARLIEST_DOCUMENT_DATE);
  });
});

describe('epochOfIsoDate', () => {
  it('reads a day at midnight UTC, so no timezone moves it', () => {
    expect(epochOfIsoDate('2024-03-18')).toBe(Date.UTC(2024, 2, 18));
  });

  it('is NaN for something that is not a date', () => {
    expect(Number.isNaN(epochOfIsoDate('nonsense'))).toBe(true);
  });
});
