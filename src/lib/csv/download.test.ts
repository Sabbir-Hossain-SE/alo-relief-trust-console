import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileNameFrom, saveBlob } from './download';

describe('fileNameFrom', () => {
  it('takes the name the server asked for', () => {
    expect(fileNameFrom('attachment; filename="documents-2026-09-04.csv"', 'fallback.csv')).toBe(
      'documents-2026-09-04.csv',
    );
  });

  it('falls back when the header is absent or unparseable', () => {
    expect(fileNameFrom(null, 'fallback.csv')).toBe('fallback.csv');
    expect(fileNameFrom('attachment', 'fallback.csv')).toBe('fallback.csv');
  });
});

describe('saveBlob', () => {
  const createObjectURL = vi.fn(() => 'blob:mock');
  const revokeObjectURL = vi.fn();

  // Defined onto the real URL rather than replacing it: a plain object spread
  // of the class is not a constructor, and everything else still needs one.
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });

  afterEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it('clicks a download link for the blob', () => {
    const clicks: { href: string; download: string }[] = [];

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({ href: this.href, download: this.download });
    });

    saveBlob(new Blob(['a,b\r\n']), 'export.csv');

    expect(clicks).toEqual([{ href: 'blob:mock', download: 'export.csv' }]);
  });

  // Leaving the URL alive pins the whole file in memory for the lifetime of
  // the page, which for a 100,000-row export is the entire archive again.
  it('revokes the object url rather than leaking the file', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    saveBlob(new Blob(['a']), 'export.csv');

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('leaves nothing behind in the document', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    saveBlob(new Blob(['a']), 'export.csv');

    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});
