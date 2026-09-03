/**
 * Hands a generated file to the browser's download machinery.
 *
 * An object URL rather than a data URL: a data URL has to hold the whole file
 * as a base64 string in the document, which for a 100,000-row export is tens of
 * megabytes of string on top of the blob itself.
 *
 * The URL is revoked immediately after the click. The browser has already taken
 * its own reference to the blob by then, and leaving it alive pins the file in
 * memory for the lifetime of the page.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  // Kept out of the layout: appending is only needed because Firefox ignores a
  // click on an anchor that is not in the document.
  link.style.display = 'none';

  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

/** Pulls the filename the server asked for, falling back when it did not. */
export function fileNameFrom(disposition: string | null, fallback: string): string {
  const match = disposition === null ? null : /filename="([^"]+)"/.exec(disposition);
  return match?.[1] ?? fallback;
}
