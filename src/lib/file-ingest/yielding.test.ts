import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCancelled, yieldToMain } from './yielding';

const globals = globalThis as { scheduler?: unknown };

afterEach(() => {
  delete globals.scheduler;
});

describe('yieldToMain', () => {
  it('prefers scheduler.yield when the browser has it', async () => {
    const schedulerYield = vi.fn(() => Promise.resolve());
    globals.scheduler = { yield: schedulerYield };

    await yieldToMain();

    expect(schedulerYield).toHaveBeenCalledTimes(1);
  });

  // jsdom has no scheduler, so this is the branch every existing walk test
  // already runs through — asserted here so the fallback is not silently lost.
  it('falls back to a task when there is no scheduler', async () => {
    await expect(yieldToMain()).resolves.toBeUndefined();
  });

  it('falls back when scheduler exists without yield', async () => {
    globals.scheduler = { postTask: () => undefined };

    await expect(yieldToMain()).resolves.toBeUndefined();
  });
});

describe('isCancelled', () => {
  it('is false when nothing can cancel', () => {
    expect(isCancelled(undefined)).toBe(false);
  });

  it('follows the signal', () => {
    const controller = new AbortController();

    expect(isCancelled(controller.signal)).toBe(false);
    controller.abort();
    expect(isCancelled(controller.signal)).toBe(true);
  });
});
