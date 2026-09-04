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
    expect(fileNameFrom('attachment; filename=""', 'fallback.csv')).toBe('fallback.csv');
  });

  it('reads a name the server did not quote', () => {
    expect(fileNameFrom('attachment; filename=documents.csv', 'fallback.csv')).toBe(
      'documents.csv',
    );
  });

  // The form a real backend uses for anything outside ASCII, and the one it
  // prefers when both are sent.
  it('reads the encoded form, and prefers it to the plain one', () => {
    expect(
      fileNameFrom(`attachment; filename="plain.csv"; filename*=UTF-8''r%C3%A9sum%C3%A9.csv`, 'x'),
    ).toBe('résumé.csv');
  });

  it('falls back to the plain form when the encoded one is malformed', () => {
    expect(fileNameFrom(`attachment; filename="plain.csv"; filename*=UTF-8''%E0%A4%A`, 'x')).toBe(
      'plain.csv',
    );
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
    vi.useFakeTimers();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    saveBlob(new Blob(['a']), 'export.csv');
    vi.runAllTimers();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    vi.useRealTimers();
  });

  // Safari and Firefox start the download after the click returns. Revoked
  // synchronously, the URL is gone before they read it and nothing is saved.
  it('leaves the url alive until the browser has had time to open it', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    saveBlob(new Blob(['a']), 'export.csv');

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('leaves nothing behind in the document', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    saveBlob(new Blob(['a']), 'export.csv');

    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});
