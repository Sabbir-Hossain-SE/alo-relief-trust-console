import type { QueueItem, QueueOptions, QueueSnapshot, QueueTask, TaskStatus } from './types';

const DEFAULTS = {
  concurrency: 6,
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 8000,
};

/** Resolves after `ms`, or immediately when the signal aborts. */
function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();

    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });

    function finish() {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    }
  });
}

const FINAL: readonly TaskStatus[] = ['succeeded', 'failed', 'cancelled'];

export type UploadQueue = {
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  cancelTask: (id: string) => void;
  snapshot: () => QueueSnapshot;
};

/**
 * Moves a large queue through a narrow pipe, interruptibly.
 *
 * Framework-free on purpose: concurrency, backoff, pause and cancel are all
 * pure scheduling problems, and keeping them out of React means they can be
 * tested without rendering anything and reused if the transport changes.
 */
export function createUploadQueue<T extends QueueItem>(
  items: readonly T[],
  options: QueueOptions<T>,
): UploadQueue {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULTS.concurrency);
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULTS.maxAttempts);
  const baseDelayMs = options.baseDelayMs ?? DEFAULTS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const sleep = options.sleep ?? defaultSleep;

  const tasks = new Map<string, QueueTask>(
    items.map((item) => [
      item.id,
      { id: item.id, label: item.label, status: 'queued', attempts: 0, progress: 0 },
    ]),
  );

  const byId = new Map(items.map((item) => [item.id, item]));
  const pending = items.map((item) => item.id);
  const controllers = new Map<string, AbortController>();

  const queueController = new AbortController();
  let paused = false;
  let running = 0;
  let resumeWaiters: (() => void)[] = [];

  function counts() {
    let succeeded = 0;
    let failed = 0;
    let cancelled = 0;

    for (const task of tasks.values()) {
      if (task.status === 'succeeded') succeeded += 1;
      else if (task.status === 'failed') failed += 1;
      else if (task.status === 'cancelled') cancelled += 1;
    }

    return { succeeded, failed, cancelled };
  }

  function snapshot(): QueueSnapshot {
    const { succeeded, failed, cancelled } = counts();
    const total = tasks.size;
    const finished = succeeded + failed + cancelled;

    return {
      tasks: [...tasks.values()],
      total,
      succeeded,
      failed,
      cancelled,
      running,
      completion: total === 0 ? 1 : finished / total,
      paused,
      settled: finished === total,
    };
  }

  function emit() {
    options.onChange?.(snapshot());
  }

  function update(id: string, patch: Partial<QueueTask>) {
    const task = tasks.get(id);
    if (task === undefined || FINAL.includes(task.status)) return;

    tasks.set(id, { ...task, ...patch });
  }

  /** Blocks a worker while paused, without abandoning its slot. */
  function waitWhilePaused(): Promise<void> {
    if (!paused || queueController.signal.aborted) return Promise.resolve();
    return new Promise((resolve) => resumeWaiters.push(resolve));
  }

  // Exponential, capped. Without the cap a queue with a few bad files stalls
  // for minutes on the last attempts.
  function backoffFor(attempt: number): number {
    return Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  }

  async function attempt(item: T): Promise<void> {
    for (let tryNumber = 1; tryNumber <= maxAttempts; tryNumber += 1) {
      await waitWhilePaused();

      if (queueController.signal.aborted || tasks.get(item.id)?.status === 'cancelled') {
        update(item.id, { status: 'cancelled' });
        return;
      }

      const controller = new AbortController();
      controllers.set(item.id, controller);

      update(item.id, { status: 'running', attempts: tryNumber, progress: 0 });
      emit();

      try {
        await options.run(item, {
          signal: controller.signal,
          attempt: tryNumber,
          onProgress: (fraction) => {
            update(item.id, { progress: Math.min(1, Math.max(0, fraction)) });
            emit();
          },
        });

        update(item.id, { status: 'succeeded', progress: 1 });
        return;
      } catch (error) {
        const cancelled = controller.signal.aborted || queueController.signal.aborted;

        if (cancelled) {
          update(item.id, { status: 'cancelled' });
          return;
        }

        const message = error instanceof Error ? error.message : 'Upload failed';

        if (tryNumber >= maxAttempts) {
          update(item.id, { status: 'failed', error: message });
          return;
        }

        update(item.id, { status: 'waiting', error: message });
        emit();

        await sleep(backoffFor(tryNumber), queueController.signal);
      } finally {
        controllers.delete(item.id);
      }
    }
  }

  async function worker(): Promise<void> {
    for (;;) {
      await waitWhilePaused();

      if (queueController.signal.aborted) return;

      const id = pending.shift();
      if (id === undefined) return;

      const item = byId.get(id);
      if (item === undefined) continue;

      running += 1;
      emit();

      await attempt(item);

      running -= 1;
      emit();
    }
  }

  async function start(): Promise<void> {
    emit();

    // Exactly `concurrency` workers pull from one shared list, so the limit is
    // structural rather than something a counter has to be trusted to enforce.
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);

    emit();
  }

  function releasePaused() {
    const waiters = resumeWaiters;
    resumeWaiters = [];
    for (const resolve of waiters) resolve();
  }

  return {
    start,
    snapshot,

    pause() {
      if (paused) return;
      paused = true;
      emit();
    },

    resume() {
      if (!paused) return;
      paused = false;
      releasePaused();
      emit();
    },

    cancel() {
      queueController.abort();
      for (const controller of controllers.values()) controller.abort();

      for (const task of tasks.values()) {
        if (!FINAL.includes(task.status)) tasks.set(task.id, { ...task, status: 'cancelled' });
      }

      pending.length = 0;
      paused = false;
      releasePaused();
      emit();
    },

    cancelTask(id: string) {
      const task = tasks.get(id);
      if (task === undefined || FINAL.includes(task.status)) return;

      tasks.set(id, { ...task, status: 'cancelled' });
      controllers.get(id)?.abort();

      const queuedAt = pending.indexOf(id);
      if (queuedAt >= 0) pending.splice(queuedAt, 1);

      emit();
    },
  };
}
