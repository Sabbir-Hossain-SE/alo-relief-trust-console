import { describe, expect, it } from 'vitest';
import { createUploadQueue } from './queue';
import { PermanentFailure, TASK_STATUSES, isPermanentFailure } from './types';
import type { QueueItem, RunContext } from './types';

function items(count: number): QueueItem[] {
  return Array.from({ length: count }, (_, i) => ({ id: `f${i}`, label: `file-${i}.pdf` }));
}

/** Resolves on the next microtask, letting the queue advance one step. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Records how long each backoff asked for, without waiting it out. */
function recordingSleep() {
  const delays: number[] = [];
  return {
    delays,
    sleep: async (ms: number) => {
      delays.push(ms);
    },
  };
}

describe('concurrency', () => {
  it('never runs more than the limit at once', async () => {
    let inFlight = 0;
    let peak = 0;

    const queue = createUploadQueue(items(50), {
      concurrency: 4,
      run: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await tick();
        inFlight -= 1;
      },
    });

    await queue.start();

    expect(peak).toBe(4);
    expect(queue.snapshot().succeeded).toBe(50);
  });

  /**
   * A snapshot used to copy and recount every task, five times per file, so a
   * queue of tens of thousands spent its time describing itself. The count of
   * changes is the observable; the cost per change is what shrank.
   */
  it('reports a number of changes that grows with the queue, not with its square', async () => {
    const changes = async (count: number) => {
      let seen = 0;
      const queue = createUploadQueue(
        Array.from({ length: count }, (_, i) => ({ id: `f${i}`, label: `f${i}` })),
        { concurrency: 8, run: async () => {}, onChange: () => (seen += 1) },
      );
      await queue.start();
      return seen;
    };

    const small = await changes(200);
    const large = await changes(800);

    expect(large / small).toBeLessThan(4.5);
    expect(large).toBeLessThan(800 * 4);
  });

  it('hands out the same task object until it changes', async () => {
    const queue = createUploadQueue(
      [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
      ],
      {
        concurrency: 1,
        run: async () => {},
      },
    );

    const before = queue.snapshot().tasks[1];
    await queue.start();
    const after = queue.snapshot();

    expect(after.tasks[1]).not.toBe(before);
    expect(after.tasks[1]?.status).toBe('succeeded');
    expect(after.succeeded).toBe(2);
  });

  it('reports the running count while work is in flight', async () => {
    const seen: number[] = [];

    const queue = createUploadQueue(items(20), {
      concurrency: 3,
      onChange: (snapshot) => seen.push(snapshot.running),
      run: async () => {
        await tick();
      },
    });

    await queue.start();

    expect(Math.max(...seen)).toBe(3);
    expect(queue.snapshot().running).toBe(0);
  });

  it('does not start more workers than there are tasks', async () => {
    let peak = 0;
    let inFlight = 0;

    const queue = createUploadQueue(items(2), {
      concurrency: 10,
      run: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await tick();
        inFlight -= 1;
      },
    });

    await queue.start();

    expect(peak).toBe(2);
  });

  it('settles an empty queue immediately', async () => {
    const queue = createUploadQueue([], { run: async () => undefined });
    await queue.start();

    expect(queue.snapshot()).toMatchObject({ total: 0, settled: true, completion: 1 });
  });

  it('treats a concurrency below one as one', async () => {
    let peak = 0;
    let inFlight = 0;

    const queue = createUploadQueue(items(5), {
      concurrency: 0,
      run: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await tick();
        inFlight -= 1;
      },
    });

    await queue.start();

    expect(peak).toBe(1);
  });
});

describe('retry and backoff', () => {
  it('retries a failing task up to the cap', async () => {
    let calls = 0;
    const { sleep } = recordingSleep();

    const queue = createUploadQueue(items(1), {
      maxAttempts: 3,
      sleep,
      run: async () => {
        calls += 1;
        throw new Error('network');
      },
    });

    await queue.start();

    expect(calls).toBe(3);
    expect(queue.snapshot().failed).toBe(1);
    expect(queue.snapshot().tasks[0]).toMatchObject({ attempts: 3, error: 'network' });
  });

  it('backs off exponentially between attempts', async () => {
    const { sleep, delays } = recordingSleep();

    const queue = createUploadQueue(items(1), {
      maxAttempts: 4,
      baseDelayMs: 100,
      sleep,
      run: async () => {
        throw new Error('flaky');
      },
    });

    await queue.start();

    // Three failures produce three waits, doubling each time. No wait follows
    // the final attempt, because nothing comes after it.
    expect(delays).toEqual([100, 200, 400]);
  });

  it('caps the backoff so a long queue cannot stall', async () => {
    const { sleep, delays } = recordingSleep();

    const queue = createUploadQueue(items(1), {
      maxAttempts: 8,
      baseDelayMs: 1000,
      maxDelayMs: 4000,
      sleep,
      run: async () => {
        throw new Error('flaky');
      },
    });

    await queue.start();

    expect(delays).toEqual([1000, 2000, 4000, 4000, 4000, 4000, 4000]);
  });

  it('stops retrying as soon as an attempt succeeds', async () => {
    let calls = 0;

    const queue = createUploadQueue(items(1), {
      maxAttempts: 5,
      sleep: async () => undefined,
      run: async () => {
        calls += 1;
        if (calls < 3) throw new Error('transient');
      },
    });

    await queue.start();

    expect(calls).toBe(3);
    expect(queue.snapshot()).toMatchObject({ succeeded: 1, failed: 0 });
  });

  it('tells the task which attempt it is on', async () => {
    const seen: number[] = [];

    const queue = createUploadQueue(items(1), {
      maxAttempts: 3,
      sleep: async () => undefined,
      run: async (_item, context: RunContext) => {
        seen.push(context.attempt);
        throw new Error('again');
      },
    });

    await queue.start();

    expect(seen).toEqual([1, 2, 3]);
  });

  // A server that refused a file — a name too long, a shape it does not take —
  // refuses it identically every time, and backing off between refusals only
  // spends seconds per file learning nothing.
  it('gives up at once on a failure another attempt cannot help', async () => {
    let calls = 0;
    const { sleep, delays } = recordingSleep();

    const queue = createUploadQueue(items(1), {
      maxAttempts: 3,
      sleep,
      run: async () => {
        calls += 1;
        throw new PermanentFailure('That file could not be read.');
      },
    });

    await queue.start();

    expect(calls).toBe(1);
    expect(delays).toEqual([]);
    expect(queue.snapshot().tasks[0]).toMatchObject({
      status: 'failed',
      attempts: 1,
      error: 'That file could not be read.',
    });
  });

  it('recognises a permanent failure by shape, not only by class', () => {
    expect(isPermanentFailure(new PermanentFailure('no'))).toBe(true);
    expect(isPermanentFailure({ permanent: true })).toBe(true);
    expect(isPermanentFailure(new Error('network'))).toBe(false);
    expect(isPermanentFailure(null)).toBe(false);
  });

  it('keeps one failure from stopping the rest', async () => {
    const queue = createUploadQueue(items(10), {
      maxAttempts: 1,
      concurrency: 2,
      run: async (item) => {
        if (item.id === 'f3') throw new Error('bad file');
      },
    });

    await queue.start();

    expect(queue.snapshot()).toMatchObject({ succeeded: 9, failed: 1, settled: true });
  });
});

describe('progress', () => {
  it('reports per-file progress', async () => {
    const queue = createUploadQueue(items(1), {
      run: async (_item, context) => {
        context.onProgress(0.25);
        context.onProgress(0.75);
      },
    });

    await queue.start();

    expect(queue.snapshot().tasks[0]?.progress).toBe(1);
  });

  it('clamps progress that strays outside 0 to 1', async () => {
    const seen: number[] = [];

    const queue = createUploadQueue(items(1), {
      onChange: (snapshot) => {
        const task = snapshot.tasks[0];
        if (task?.status === 'running') seen.push(task.progress);
      },
      run: async (_item, context) => {
        context.onProgress(-5);
        context.onProgress(9);
      },
    });

    await queue.start();

    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...seen)).toBeLessThanOrEqual(1);
  });

  it('reports overall completion as tasks finish', async () => {
    const queue = createUploadQueue(items(4), {
      concurrency: 1,
      run: async () => {
        await tick();
      },
    });

    await queue.start();

    expect(queue.snapshot().completion).toBe(1);
  });
});

describe('pause and resume', () => {
  it('stops starting new work while paused', async () => {
    let started = 0;

    const queue = createUploadQueue(items(20), {
      concurrency: 2,
      run: async () => {
        started += 1;
        await tick();
      },
    });

    const done = queue.start();
    await tick();
    queue.pause();

    const atPause = started;
    await tick();
    await tick();

    // Whatever was already running may finish, but nothing new begins.
    expect(started).toBeLessThanOrEqual(atPause + 2);
    expect(queue.snapshot().paused).toBe(true);

    queue.resume();
    await done;

    expect(queue.snapshot()).toMatchObject({ succeeded: 20, paused: false, settled: true });
  });

  it('finishes everything after a pause and resume', async () => {
    const queue = createUploadQueue(items(30), {
      concurrency: 4,
      run: async () => {
        await tick();
      },
    });

    const done = queue.start();
    await tick();
    queue.pause();
    await tick();
    queue.resume();
    await done;

    expect(queue.snapshot().succeeded).toBe(30);
  });

  it('ignores a redundant pause or resume', async () => {
    const queue = createUploadQueue(items(4), { run: async () => undefined });

    queue.resume();
    expect(queue.snapshot().paused).toBe(false);

    queue.pause();
    queue.pause();
    expect(queue.snapshot().paused).toBe(true);

    queue.resume();
    await queue.start();
    expect(queue.snapshot().succeeded).toBe(4);
  });
});

describe('cancellation', () => {
  it('stops the whole queue and marks the rest cancelled', async () => {
    const queue = createUploadQueue(items(40), {
      concurrency: 2,
      run: async () => {
        await tick();
      },
    });

    const done = queue.start();
    await tick();
    queue.cancel();
    await done;

    const snapshot = queue.snapshot();
    expect(snapshot.cancelled).toBeGreaterThan(0);
    expect(snapshot.settled).toBe(true);
    expect(snapshot.succeeded + snapshot.failed + snapshot.cancelled).toBe(40);
  });

  it('signals in-flight work so it can abort its own request', async () => {
    let aborted = false;

    const queue = createUploadQueue(items(1), {
      run: async (_item, context) => {
        context.signal.addEventListener('abort', () => {
          aborted = true;
        });
        await tick();
        await tick();
      },
    });

    const done = queue.start();
    await tick();
    queue.cancel();
    await done;

    expect(aborted).toBe(true);
  });

  it('cancels one task without disturbing the others', async () => {
    const queue = createUploadQueue(items(6), {
      concurrency: 1,
      run: async () => {
        await tick();
      },
    });

    queue.cancelTask('f4');
    await queue.start();

    const snapshot = queue.snapshot();
    expect(snapshot.tasks.find((task) => task.id === 'f4')?.status).toBe('cancelled');
    expect(snapshot.succeeded).toBe(5);
    expect(snapshot.cancelled).toBe(1);
  });

  it('leaves a finished task alone when cancelled afterwards', async () => {
    const queue = createUploadQueue(items(2), { run: async () => undefined });
    await queue.start();

    queue.cancel();

    expect(queue.snapshot()).toMatchObject({ succeeded: 2, cancelled: 0 });
  });

  it('does not retry a task that was cancelled mid-attempt', async () => {
    let calls = 0;

    const queue = createUploadQueue(items(1), {
      maxAttempts: 5,
      sleep: async () => undefined,
      run: async (_item, context) => {
        calls += 1;
        await tick();
        if (context.signal.aborted) throw new Error('aborted');
        throw new Error('network');
      },
    });

    const done = queue.start();
    await tick();
    queue.cancel();
    await done;

    expect(calls).toBe(1);
    expect(queue.snapshot().cancelled).toBe(1);
  });
});

describe('the built-in backoff wait', () => {
  // Every other test injects `sleep` to keep the suite instant, which leaves the
  // wait the application actually ships with unexercised.
  it('really waits between attempts when nothing is injected', async () => {
    let calls = 0;
    const started = Date.now();

    const queue = createUploadQueue(items(1), {
      maxAttempts: 2,
      baseDelayMs: 30,
      run: async () => {
        calls += 1;
        if (calls === 1) throw new Error('503');
      },
    });

    await queue.start();

    expect(calls).toBe(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(25);
    expect(queue.snapshot().succeeded).toBe(1);
  });

  it('abandons the wait as soon as the queue is cancelled', async () => {
    const queue = createUploadQueue(items(1), {
      maxAttempts: 3,
      // Long enough that finishing at all proves the wait was cut short rather
      // than waited out.
      baseDelayMs: 30_000,
      run: async () => {
        throw new Error('503');
      },
    });

    const started = Date.now();
    const done = queue.start();
    await tick();
    queue.cancel();
    await done;

    expect(Date.now() - started).toBeLessThan(1000);
    expect(queue.snapshot().settled).toBe(true);
  });
});

describe('pause then cancel', () => {
  // The queue bar offers both, and an operator who pauses and then gives up
  // leaves workers parked inside an attempt rather than between two.
  it('cancels the work parked at the pause instead of resuming it', async () => {
    let started = 0;

    const queue = createUploadQueue(items(8), {
      concurrency: 2,
      run: async () => {
        started += 1;
        await tick();
      },
    });

    const done = queue.start();
    await tick();
    queue.pause();
    await tick();

    const atPause = started;
    queue.cancel();
    await done;

    const snapshot = queue.snapshot();
    expect(started).toBe(atPause);
    expect(snapshot.settled).toBe(true);
    expect(snapshot.paused).toBe(false);
    expect(snapshot.succeeded + snapshot.failed + snapshot.cancelled).toBe(8);
    expect(snapshot.cancelled).toBeGreaterThan(0);
  });
});

describe('the reported task status', () => {
  // The queue bar renders per status, so a status it invents shows up as a task
  // with no label rather than as an error anyone would notice.
  it('only ever reports statuses the type declares', async () => {
    const queue = createUploadQueue(items(6), {
      concurrency: 2,
      maxAttempts: 2,
      sleep: async () => undefined,
      run: async (item) => {
        if (item.id === 'f1') throw new Error('503');
      },
    });

    queue.cancelTask('f5');
    await queue.start();

    const seen = new Set(queue.snapshot().tasks.map((task) => task.status));

    expect([...seen].every((status) => TASK_STATUSES.includes(status))).toBe(true);
    expect(seen).toEqual(new Set(['succeeded', 'failed', 'cancelled']));
  });
});
