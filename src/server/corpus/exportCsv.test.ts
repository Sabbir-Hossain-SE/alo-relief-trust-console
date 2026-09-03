import { describe, expect, it } from 'vitest';
import { CSV_BOM } from '@/lib/csv/serialize';
import { PROCESSING_STATUSES, type ProcessingStatus } from '@/domain/status';
import { buildColumnStore } from './columnStore';
import { documentId } from './documentAt';
import { DOCUMENT_CSV_COLUMNS, documentsToCsv, exportFileName } from './exportCsv';
import { applyPatch, createOverlay } from './overlay';
import { filterIndices } from './query';

const SEED = 20260901;
const SIZE = 2000;
const store = buildColumnStore(SEED, SIZE);
const empty = createOverlay();

function statusOf(index: number): ProcessingStatus {
  return PROCESSING_STATUSES[store.statusId[index] as number] as ProcessingStatus;
}

function firstWithStatus(status: ProcessingStatus): number {
  for (let index = 0; index < SIZE; index += 1) {
    if (statusOf(index) === status) return index;
  }
  throw new Error(`No ${status} document in the sample`);
}

/** Splits on row ends only, which is safe because no column here is multi-line. */
function lines(csv: string): string[] {
  return csv.slice(CSV_BOM.length).split('\r\n').slice(0, -1);
}

/** Splits one CSV line into fields, honouring quotes. */
function fieldsOf(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      fields.push(field);
      field = '';
    } else field += char;
  }

  fields.push(field);
  return fields;
}

function columnOf(line: string, name: (typeof DOCUMENT_CSV_COLUMNS)[number]): string {
  return fieldsOf(line)[DOCUMENT_CSV_COLUMNS.indexOf(name)] as string;
}

describe('documentsToCsv', () => {
  it('writes a header and one line per document', () => {
    const indices = filterIndices(store, empty, {});
    const out = lines(documentsToCsv(store, empty, indices));

    expect(out[0]).toBe(DOCUMENT_CSV_COLUMNS.join(','));
    expect(out).toHaveLength(SIZE + 1);
  });

  it('exports exactly what the filter matched, in the order it was given', () => {
    const indices = filterIndices(store, empty, { status: ['failed'] });
    const out = lines(documentsToCsv(store, empty, indices));

    expect(out).toHaveLength(indices.length + 1);
    expect(out[1]).toContain(documentId(indices[0] as number));
  });

  it('writes a header-only file when nothing matched', () => {
    expect(lines(documentsToCsv(store, empty, new Uint32Array(0)))).toHaveLength(1);
  });

  // 0% reads as "the pipeline was certain it was wrong", which is a different
  // claim from "the pipeline never read it".
  it('leaves confidence empty for a document that was never extracted', () => {
    const index = firstWithStatus('failed');
    const [, row] = lines(documentsToCsv(store, empty, Uint32Array.of(index)));

    expect(columnOf(row as string, 'Confidence')).toBe('');
    expect(columnOf(row as string, 'Confidence band')).toBe('');
  });

  it('writes confidence as a number a spreadsheet can average', () => {
    const index = firstWithStatus('completed');
    const [, row] = lines(documentsToCsv(store, empty, Uint32Array.of(index)));
    const value = Number(columnOf(row as string, 'Confidence'));

    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(1);
  });

  it('names the failure rather than emitting its code', () => {
    const index = firstWithStatus('failed');
    const [, row] = lines(documentsToCsv(store, empty, Uint32Array.of(index)));
    const failure = columnOf(row as string, 'Failure');

    expect(failure.length).toBeGreaterThan(0);
    expect(failure).not.toMatch(/^[a-z_]+$/);
  });

  it('dates rows in a format that parses the same way everywhere', () => {
    const index = firstWithStatus('completed');
    const [, row] = lines(documentsToCsv(store, empty, Uint32Array.of(index)));

    expect(columnOf(row as string, 'Uploaded')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('exports a corrected status rather than the generated one', () => {
    const overlay = createOverlay();
    const index = firstWithStatus('needs_review');

    applyPatch(overlay, index, { status: 'completed' });
    const [, row] = lines(documentsToCsv(store, overlay, Uint32Array.of(index)));

    expect(columnOf(row as string, 'Status')).toBe('Completed');
  });
});

describe('exportFileName', () => {
  it('dates the file, so a folder of exports is navigable', () => {
    expect(exportFileName(new Date('2026-09-04T09:30:00Z'))).toBe(
      'alo-relief-trust-documents-2026-09-04.csv',
    );
  });
});
