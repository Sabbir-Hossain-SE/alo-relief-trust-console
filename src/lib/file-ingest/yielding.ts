type SchedulerLike = { yield?: () => Promise<void> };

/**
 * Hands control back to the browser between chunks of work.
 *
 * Prefers `scheduler.yield()`, which returns at the front of the task queue and
 * so does not lose the thread to unrelated work. Falls back to a zero timeout,
 * which yields but rejoins the back of the queue.
 *
 * Without this, walking a large folder holds the main thread for seconds: no
 * paint, no scroll, no cancel button.
 */
export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: SchedulerLike }).scheduler;

  if (typeof scheduler?.yield === 'function') {
    return scheduler.yield();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Reports whether an abort has been requested, without throwing. */
export function isCancelled(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}
