import { expect, test } from '@playwright/test';
import { INJECTED_UPLOAD_FAILURES, failOnConsoleErrors, open } from './support/console';

const FILE_COUNT = 60;

const PDF = Buffer.from('%PDF-1.4\n% mock intake scan\n%%EOF\n');

const selection = Array.from({ length: FILE_COUNT }, (_, i) => ({
  name: `intake-${i + 1}.pdf`,
  mimeType: 'application/pdf',
  buffer: PDF,
}));

/**
 * Reloading mid-upload asks the operator whether to leave. Saying no used to
 * cost them the backend: the worker library reports the page closed on that
 * same event, the service worker dropped the page and unregistered itself, and
 * every request from the page that stayed fell through to the real server as
 * a 404 — the upload the prompt was protecting failed in full, and so did
 * every screen after it.
 */
test('keeps the backend when the operator chooses to stay', async ({ page }) => {
  // An upload, a batch and a grid in one flow, against a backend that pauses
  // a share of uploads on purpose.
  test.setTimeout(90_000);

  const assertQuiet = failOnConsoleErrors(page, [INJECTED_UPLOAD_FAILURES]);

  await open(page, '/upload');
  await page.locator('input[type="file"][accept]').setInputFiles(selection);
  await page.getByRole('button', { name: 'Start processing' }).click();
  await expect(page.getByRole('list', { name: 'Upload queue' })).toBeVisible();

  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.evaluate(() => {
    // A browser navigation on purpose: the prompt fires for those, not for
    // the router's own transitions.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/documents';
  });

  // Asked, and stayed.
  await expect(page).toHaveURL(/\/upload$/);

  // The run carries on to its batch with nothing lost to the real server.
  await expect(page).toHaveURL(/\/batches\/[^/?]+$/, { timeout: 60_000 });
  const meta = await page
    .getByText(/\d+ of \d+ processed/)
    .first()
    .innerText();
  const total = Number(meta.match(/of (\d+) processed/)?.[1]);
  // The backend still injects the odd 503, and three of those in a row lose a
  // file honestly; a 404 would have lost most of them.
  expect(total).toBeGreaterThanOrEqual(FILE_COUNT - 2);

  // And the archive still answers.
  await page.getByRole('link', { name: 'Documents', exact: true }).click();
  const grid = page.getByRole('grid', { name: 'Documents in the archive' });
  await expect(grid.getByRole('row').nth(1)).toBeVisible({ timeout: 15_000 });

  assertQuiet();
});
