import { describe, expect, it } from 'vitest';
import { fromSearchParams } from '@/server/api-contract';
import { batchDocumentsHref, batchFailureHref, batchHref } from './links';

// A link is only useful if the grid parses back exactly what it encoded.
function parse(href: string) {
  return fromSearchParams(new URLSearchParams(href.split('?')[1] ?? ''));
}

describe('batchDocumentsHref', () => {
  it('round-trips a batch and status through the grid parser', () => {
    expect(parse(batchDocumentsHref('batch-3', 'failed'))).toEqual({
      batchId: 'batch-3',
      status: ['failed'],
    });
  });

  it('links the whole batch when no status is given', () => {
    expect(parse(batchDocumentsHref('batch-3'))).toEqual({ batchId: 'batch-3' });
  });

  it('points at the documents view', () => {
    expect(batchDocumentsHref('batch-3')).toMatch(/^\/documents\?/);
  });
});

describe('batchFailureHref', () => {
  it('carries the batch, the failed status and the cause', () => {
    expect(parse(batchFailureHref('batch-3', 'ocr_timeout'))).toEqual({
      batchId: 'batch-3',
      status: ['failed'],
      errorCode: ['ocr_timeout'],
    });
  });
});

describe('batchHref', () => {
  it('addresses one batch monitor', () => {
    expect(batchHref('batch-3')).toBe('/batches/batch-3');
  });
});
