import { describe, expect, it } from 'vitest';
import { POLL_INTERVAL_MS, nextPollInterval } from './polling';

describe('nextPollInterval', () => {
  it('keeps asking while the work is unfinished, or not yet known', () => {
    expect(nextPollInterval(false, false)).toBe(POLL_INTERVAL_MS);
    expect(nextPollInterval(false, undefined)).toBe(POLL_INTERVAL_MS);
  });

  it('stops once the work has settled', () => {
    expect(nextPollInterval(false, true)).toBe(0);
  });

  /**
   * A batch that was not there was asked for again every second and a half,
   * for as long as the tab stayed open, under a button that said "Try again".
   */
  it('stops on an error and leaves the retry to the operator', () => {
    expect(nextPollInterval(true, undefined)).toBe(0);
    expect(nextPollInterval(true, false)).toBe(0);
  });
});
