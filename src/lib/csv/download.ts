/**
 * How long the object URL outlives the click.
 *
 * Safari and Firefox begin the download after the click handler has returned,
 * so a URL revoked synchronously can be gone before they read it, and the
 * download silently produces nothing. The cost of waiting is the file staying
 * in memory for a few more seconds rather than for the lifetime of the page.
 */
const REVOKE_DELAY_MS = 5000;

/**
 * Hands a generated file to the browser's download machinery.
 *
 * An object URL rather than a data URL: a data URL has to hold the whole file
 * as a base64 string in the document, which for a 100,000-row export is tens of
 * megabytes of string on top of the blob itself.
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

  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/**
 * Pulls the filename the server asked for, falling back when it did not.
 *
 * Reads both forms a Content-Disposition header can take: the RFC 5987
 * `filename*=UTF-8''…` form a real backend uses for anything outside ASCII,
 * and the plain `filename=` form, quoted or not.
 */
export function fileNameFrom(disposition: string | null, fallback: string): string {
  if (disposition === null) return fallback;

  const encoded = /filename\*=utf-8''([^;]+)/i.exec(disposition)?.[1]?.trim();
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Not valid percent-encoding, so read the plain form beside it instead.
    }
  }

  const plain = /filename=(?:"([^"]*)"|([^;]+))/i.exec(disposition);
  const name = (plain?.[1] ?? plain?.[2])?.trim();

  return name ? name : fallback;
}
