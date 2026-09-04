export const TASK_STATUSES = [
  'queued',
  'running',
  'waiting',
  'succeeded',
  'failed',
  'cancelled',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type QueueTask = {
  id: string;
  label: string;
  status: TaskStatus;
  /** Attempts made so far, including the one in progress. */
  attempts: number;
  /** 0 to 1 for the current attempt. */
  progress: number;
  error?: string;
};

export type QueueSnapshot = {
  tasks: readonly QueueTask[];
  total: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  running: number;
  /** Fraction of tasks that have reached a final state. */
  completion: number;
  paused: boolean;
  /** True once nothing is left to run. */
  settled: boolean;
};

export type RunContext = {
  signal: AbortSignal;
  attempt: number;
  onProgress: (fraction: number) => void;
};

export type QueueItem = {
  id: string;
  label: string;
};

export type QueueOptions<T extends QueueItem> = {
  /** Tasks allowed to run at once. */
  concurrency?: number;
  /** Total attempts per task, including the first. */
  maxAttempts?: number;
  /** First retry delay; each further attempt doubles it. */
  baseDelayMs?: number;
  /** Upper bound on the backoff, so a long queue cannot stall for minutes. */
  maxDelayMs?: number;
  run: (item: T, context: RunContext) => Promise<void>;
  onChange?: (snapshot: QueueSnapshot) => void;
  /** Injectable so tests do not wait out real backoff. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
};

/**
 * Thrown by a task to say that another attempt cannot help.
 *
 * A server that has refused a file outright — too long a name, a shape it does
 * not accept — will refuse it identically every time, and retrying it with
 * backoff spends seconds per file learning nothing.
 */
export class PermanentFailure extends Error {
  readonly permanent = true;

  constructor(message: string) {
    super(message);
    this.name = 'PermanentFailure';
  }
}

// Recognised by shape rather than by class, so a copy from another bundle still counts.
export function isPermanentFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { permanent?: unknown }).permanent === true
  );
}
