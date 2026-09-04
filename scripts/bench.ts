import { appendDocuments, buildColumnStore, storeBytes } from '../src/server/corpus/columnStore';
import { detailAt, summaryAt } from '../src/server/corpus/documentAt';
import { generateCore } from '../src/server/corpus/generate';
import { createOverlay } from '../src/server/corpus/overlay';
import {
  countByStatus,
  filterIndices,
  queryDocuments,
  sortIndices,
} from '../src/server/corpus/query';
import { DEFAULT_ARCHIVE_SIZE, DEFAULT_SEED } from '../src/server/corpus/config';
import { uploadedOrder } from '../src/server/corpus/sort';

const SIZE = Number(process.argv[2]) || DEFAULT_ARCHIVE_SIZE;
const OBJECT_SAMPLE = 20_000;

/**
 * The heap comparison is repeated because it is genuinely noisy.
 *
 * `heapUsed` moves with whatever else the process allocated or collected
 * between two readings, and a single run swung between 25x and 38x. The median
 * of several is stable; the spread is printed so the figure is honest about its
 * own precision rather than quoting the flattering run.
 */
const OBJECT_REPEATS = 5;

// Times a call and hands its result back, so timings never need a mutable outer.
function time<T>(label: string, run: () => T): T {
  const start = performance.now();
  const result = run();
  console.log(`  ${label.padEnd(38)} ${(performance.now() - start).toFixed(1).padStart(8)} ms`);
  return result;
}

function mb(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

// Lets allocation settle so a heap reading reflects retained memory.
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 60));
}

async function main(): Promise<void> {
  console.log(
    `\nCorpus benchmark — ${SIZE.toLocaleString('en-GB')} documents, seed ${DEFAULT_SEED}\n`,
  );

  let store = buildColumnStore(DEFAULT_SEED, 1);
  time('build column store', () => {
    store = buildColumnStore(DEFAULT_SEED, SIZE);
  });

  const overlay = createOverlay();

  time('read one page of 50 summaries', () => {
    for (let i = 0; i < 50; i += 1) summaryAt(store, overlay, i);
  });

  time('read 1,000 detail records', () => {
    for (let i = 0; i < 1000; i += 1) detailAt(store, overlay, i);
  });

  time('regenerate 10,000 cores', () => {
    for (let i = 0; i < 10_000; i += 1) generateCore(DEFAULT_SEED, i);
  });

  console.log('');

  const all = time('filter: no filters (full scan)', () => filterIndices(store, overlay, {}));

  time('filter: by status', () => {
    filterIndices(store, overlay, { status: ['failed', 'needs_review'] });
  });

  time('filter: by status + type + confidence', () => {
    filterIndices(store, overlay, {
      status: ['completed'],
      documentType: ['enrollment_form', 'medical_intake'],
      confidence: ['high'],
    });
  });

  time('search: free text across pooled names', () => {
    filterIndices(store, overlay, { search: 'rah' });
  });

  time('sort: by upload date, full archive', () => {
    sortIndices(store, all, 'uploadedAt', 'desc');
  });

  time('sort: by confidence, full archive', () => {
    sortIndices(store, all, 'confidence', 'desc');
  });

  time('count by status', () => {
    countByStatus(store, overlay);
  });

  const page = time('full query: filter + sort + page of 50', () =>
    queryDocuments(store, overlay, {
      status: ['completed'],
      sortField: 'confidence',
      sortDirection: 'desc',
      pageSize: 50,
    }),
  );

  console.log(`  ${'  → rows returned'.padEnd(38)} ${String(page.rows.length).padStart(8)}`);
  console.log(`  ${'  → matching documents'.padEnd(38)} ${String(page.total).padStart(8)}`);

  console.log('');

  // The view the grid opens in: walked from the kept order, never sorted.
  time('default query: newest first, page of 50', () => queryDocuments(store, overlay, {}));
  time('build the kept upload order (once)', () => uploadedOrder(store));
  time('filter: by confidence band', () => filterIndices(store, overlay, { confidence: ['low'] }));
  time('search: a term that matches nothing', () =>
    filterIndices(store, overlay, { search: 'zzzznotarealname' }),
  );

  // An upload's worth of rows, folded into the kept order rather than resorted.
  const growable = buildColumnStore(DEFAULT_SEED, SIZE, 25_000);
  time('append 25,000 documents into the order', () => appendDocuments(growable, 25_000));

  // Measured rather than estimated: hold a real sample so it cannot be
  // collected, then extrapolate from the heap delta.
  const samples: number[] = [];

  for (let run = 0; run < OBJECT_REPEATS; run += 1) {
    await settle();
    const before = process.memoryUsage().heapUsed;
    const retained = Array.from({ length: OBJECT_SAMPLE }, (_, i) => detailAt(store, overlay, i));
    await settle();
    // Read the heap before `retained` can go out of scope, or the sample is of
    // memory the engine has already reclaimed.
    samples.push((process.memoryUsage().heapUsed - before) / retained.length);
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const perObject = sorted[Math.floor(sorted.length / 2)] as number;
  const asObjects = perObject * SIZE;
  const bytes = storeBytes(store);
  const low = ((sorted[0] as number) * SIZE) / bytes;
  const high = ((sorted[sorted.length - 1] as number) * SIZE) / bytes;

  console.log('');
  console.log(`  ${'column store (exact)'.padEnd(38)} ${mb(storeBytes(store)).padStart(11)}`);
  console.log(
    `  ${'bytes per document'.padEnd(38)} ${(storeBytes(store) / SIZE).toFixed(1).padStart(8)} B`,
  );
  console.log(
    `  ${`same archive as objects (median of ${OBJECT_REPEATS})`.padEnd(38)} ${mb(asObjects).padStart(11)}`,
  );
  console.log(
    `  ${'reduction'.padEnd(38)} ${(asObjects / bytes).toFixed(0).padStart(9)}x` +
      `   (${low.toFixed(0)}-${high.toFixed(0)}x across runs)`,
  );
  console.log('');
}

void main();
