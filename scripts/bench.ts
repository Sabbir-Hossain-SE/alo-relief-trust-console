import { buildColumnStore, storeBytes } from '../src/server/corpus/columnStore';
import { detailAt, summaryAt } from '../src/server/corpus/documentAt';
import { generateCore } from '../src/server/corpus/generate';
import { createOverlay } from '../src/server/corpus/overlay';
import { DEFAULT_ARCHIVE_SIZE, DEFAULT_SEED } from '../src/server/corpus/config';

const SIZE = Number(process.argv[2]) || DEFAULT_ARCHIVE_SIZE;
const OBJECT_SAMPLE = 20_000;

function time(label: string, run: () => void): void {
  const start = performance.now();
  run();
  console.log(`  ${label.padEnd(38)} ${(performance.now() - start).toFixed(1).padStart(8)} ms`);
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

  // Measured rather than estimated: hold a real sample so it cannot be
  // collected, then extrapolate from the heap delta.
  await settle();
  const before = process.memoryUsage().heapUsed;
  const retained = Array.from({ length: OBJECT_SAMPLE }, (_, i) => detailAt(store, overlay, i));
  await settle();
  const perObject = (process.memoryUsage().heapUsed - before) / retained.length;
  const asObjects = perObject * SIZE;

  console.log('');
  console.log(`  ${'column store (exact)'.padEnd(38)} ${mb(storeBytes(store)).padStart(11)}`);
  console.log(
    `  ${'bytes per document'.padEnd(38)} ${(storeBytes(store) / SIZE).toFixed(1).padStart(8)} B`,
  );
  console.log(`  ${'same archive as objects (measured)'.padEnd(38)} ${mb(asObjects).padStart(11)}`);
  console.log(
    `  ${'reduction'.padEnd(38)} ${(asObjects / storeBytes(store)).toFixed(0).padStart(9)}x`,
  );
  console.log('');
}

void main();
