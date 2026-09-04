import { describe, expect, it } from 'vitest';
import { getDatabase, prepareDatabase, resetDatabase } from './db';

describe('prepareDatabase', () => {
  it('hands every caller the one archive it built, and getDatabase the same', async () => {
    resetDatabase({ size: 50 });
    const reset = getDatabase();

    const [first, second] = await Promise.all([prepareDatabase(), prepareDatabase()]);

    // Prepared after a reset, the reset archive stands: nothing is built twice.
    expect(first).toBe(reset);
    expect(second).toBe(first);
    expect(getDatabase()).toBe(first);
  });
});
