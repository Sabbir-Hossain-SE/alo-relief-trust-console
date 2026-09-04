import { rejectionFor } from './validate';
import type {
  FsDirectoryEntry,
  FsDirectoryReader,
  FsEntry,
  FsFileEntry,
  IngestProgress,
  IngestResult,
  IngestedFile,
  RejectedFile,
} from './types';
import { isCancelled, yieldToMain } from './yielding';

export type WalkOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: IngestProgress) => void;
  /** At most this many entries between yields. */
  chunkSize?: number;
  /**
   * At most this long between yields. A count alone could not bound a frame:
   * the picker's files cost real getter calls each, and two hundred of them
   * held the thread for most of a fifth of a second.
   */
  budgetMs?: number;
};

const DEFAULT_CHUNK_SIZE = 200;
const DEFAULT_BUDGET_MS = 5;

// Whether the chunk in hand has used up its count or its time.
function chunkIsFull(
  sinceYield: number,
  chunkSize: number,
  since: number,
  budgetMs: number,
): boolean {
  return sinceYield >= chunkSize || performance.now() - since >= budgetMs;
}

function readFile(entry: FsFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(resolve, () => resolve(null));
  });
}

/**
 * Reads one directory completely.
 *
 * `readEntries` returns at most 100 entries per call and signals the end with an
 * empty array, so it has to be called in a loop. Reading it once is the classic
 * way to silently lose most of a large folder.
 */
async function readDirectory(
  reader: FsDirectoryReader,
  signal: AbortSignal | undefined,
  onBatch: () => void,
): Promise<FsEntry[]> {
  const all: FsEntry[] = [];

  for (;;) {
    // A flat folder of twenty thousand files is two hundred of these calls,
    // and a cancel that could only land between folders was no cancel at all.
    if (isCancelled(signal)) return all;

    const batch = await new Promise<FsEntry[]>((resolve) => {
      reader.readEntries(resolve, () => resolve([]));
    });

    if (batch.length === 0) return all;
    all.push(...batch);
    onBatch();
  }
}

/**
 * Walks dropped entries depth-first, yielding to the browser as it goes.
 *
 * Iterative rather than recursive: a deeply nested archive would otherwise risk
 * the call stack, and an explicit stack is what makes the walk cancellable
 * between any two entries.
 */
export async function walkEntries(
  roots: readonly FsEntry[],
  options: WalkOptions = {},
): Promise<IngestResult> {
  const {
    signal,
    onProgress,
    chunkSize = DEFAULT_CHUNK_SIZE,
    budgetMs = DEFAULT_BUDGET_MS,
  } = options;

  const files: IngestedFile[] = [];
  const rejections: RejectedFile[] = [];
  const stack: FsEntry[] = [...roots].reverse();

  let scanned = 0;
  let sinceYield = 0;
  let chunkStart = performance.now();

  const report = () =>
    onProgress?.({ scanned, accepted: files.length, rejected: rejections.length });

  while (stack.length > 0) {
    if (isCancelled(signal)) {
      report();
      return {
        files,
        rejections,
        scanned,
        accepted: files.length,
        rejected: rejections.length,
        cancelled: true,
      };
    }

    const entry = stack.pop() as FsEntry;
    scanned += 1;
    sinceYield += 1;

    if (entry.isDirectory) {
      const children = await readDirectory(
        (entry as FsDirectoryEntry).createReader(),
        signal,
        report,
      );
      // Reversed so the stack pops them in the order they were listed.
      for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i] as FsEntry);
    } else {
      const file = await readFile(entry);
      const path = entry.fullPath.replace(/^\//, '');

      if (file === null) {
        rejections.push({ path, reason: 'empty_file' });
      } else {
        const reason = rejectionFor(file.name, file.size);
        if (reason === null) files.push({ path, name: file.name, size: file.size });
        else rejections.push({ path, reason });
      }
    }

    if (chunkIsFull(sinceYield, chunkSize, chunkStart, budgetMs)) {
      sinceYield = 0;
      report();
      await yieldToMain();
      chunkStart = performance.now();
    }
  }

  report();

  return {
    files,
    rejections,
    scanned,
    accepted: files.length,
    rejected: rejections.length,
    cancelled: false,
  };
}

/**
 * Pulls the entries out of a drop, preferring the entry API so folders work.
 *
 * `DataTransferItem.webkitGetAsEntry` has to be called synchronously while the
 * drop event is still being handled; the item list is emptied afterwards.
 */
export function entriesFromDataTransfer(dataTransfer: DataTransfer): FsEntry[] {
  const entries: FsEntry[] = [];

  // Both `items` and the entry API are missing from browsers that only ever
  // offer `files`, and the caller falls back to those when nothing is returned.
  for (const item of Array.from(dataTransfer.items ?? [])) {
    if (item.kind !== 'file' || typeof item.webkitGetAsEntry !== 'function') continue;

    const entry = item.webkitGetAsEntry() as FsEntry | null;
    if (entry !== null) entries.push(entry);
  }

  return entries;
}

/**
 * Ingests a plain file list, for the input behind the drop zone.
 *
 * Chunked for the same reason as the walk: selecting tens of thousands of files
 * through the picker is just as capable of blocking the thread.
 */
export async function ingestFileList(
  fileList: readonly File[],
  options: WalkOptions = {},
): Promise<IngestResult> {
  const {
    signal,
    onProgress,
    chunkSize = DEFAULT_CHUNK_SIZE,
    budgetMs = DEFAULT_BUDGET_MS,
  } = options;
  let chunkStart = performance.now();
  let sinceYield = 0;

  const files: IngestedFile[] = [];
  const rejections: RejectedFile[] = [];
  let scanned = 0;

  const report = () =>
    onProgress?.({ scanned, accepted: files.length, rejected: rejections.length });

  for (let index = 0; index < fileList.length; index += 1) {
    if (isCancelled(signal)) {
      report();
      return {
        files,
        rejections,
        scanned,
        accepted: files.length,
        rejected: rejections.length,
        cancelled: true,
      };
    }

    const file = fileList[index] as File;
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;

    scanned += 1;

    const reason = rejectionFor(file.name, file.size);
    if (reason === null) files.push({ path, name: file.name, size: file.size });
    else rejections.push({ path, reason });

    sinceYield += 1;
    if (chunkIsFull(sinceYield, chunkSize, chunkStart, budgetMs)) {
      sinceYield = 0;
      report();
      await yieldToMain();
      chunkStart = performance.now();
    }
  }

  report();

  return {
    files,
    rejections,
    scanned,
    accepted: files.length,
    rejected: rejections.length,
    cancelled: false,
  };
}
