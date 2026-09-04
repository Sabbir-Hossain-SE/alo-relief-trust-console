import { expect, test, type Page } from '@playwright/test';
import { INJECTED_UPLOAD_FAILURES, failOnConsoleErrors, open } from './support/console';

const FILE_COUNT = 6;

/** A real, if tiny, PDF: an empty file is rejected before it is ever queued. */
const PDF = Buffer.from('%PDF-1.4\n% mock intake scan\n%%EOF\n');

const selection = Array.from({ length: FILE_COUNT }, (_, i) => ({
  name: `intake-${i + 1}.pdf`,
  mimeType: 'application/pdf',
  buffer: PDF,
}));

/** Enough files that the queue is still running when the operator changes their mind. */
const LONG_RUN = Array.from({ length: 120 }, (_, i) => ({
  name: `scan-${i + 1}.pdf`,
  mimeType: 'application/pdf',
  buffer: PDF,
}));

/** Reads one slice of the four-way split off the card's own accessible name. */
async function outcomeCount(page: Page, label: string): Promise<number> {
  const card = page.getByRole('link', { name: new RegExp(`${label} — open in documents$`) });
  const name = await card.getAttribute('aria-label');

  return Number((name ?? '').replace(/,/g, '').match(/^\d+/)?.[0]);
}

/**
 * The flow the product exists for: put documents in, then find out what
 * processing made of them.
 */
test('uploads a selection and follows the batch to its outcome', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page, [INJECTED_UPLOAD_FAILURES]);

  await open(page, '/upload');
  await expect(page.getByRole('heading', { name: 'Upload', level: 1 })).toBeVisible();

  // Driven through the real file input rather than the drop area: a drop cannot
  // be performed from a keyboard either, which is why the input exists.
  await page.locator('input[type="file"][accept]').setInputFiles(selection);

  // The count and its caption are separate elements, so the block holding both
  // is what carries the sentence.
  const ready = page.getByText('documents ready to upload');
  await expect(ready).toBeVisible();
  await expect(ready.locator('..')).toContainText(String(FILE_COUNT));

  await page.getByRole('button', { name: 'Start processing' }).click();

  // Uploading runs through a concurrency-limited queue with backoff, against a
  // backend that rejects a share of requests on purpose.
  await expect(page).toHaveURL(/\/batches\/[^/?]+$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /^Batch (in progress|complete)$/,
  );

  await expect(page.getByRole('heading', { name: 'Batch complete', level: 1 })).toBeVisible({
    timeout: 60_000,
  });

  // Only what actually arrived becomes a batch, so a file the queue gave up on
  // shrinks the total rather than appearing as a processing failure.
  const meta = await page
    .getByText(/\d+ of \d+ processed/)
    .first()
    .innerText();
  const total = Number(meta.match(/of (\d+) processed/)?.[1]);

  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThanOrEqual(FILE_COUNT);
  expect(meta).toContain('100%');

  // A batch is rarely simply done or failed, so the split is the reading — and
  // every slice of it has to account for the whole.
  const [completed, processing, failed, needsReview] = await Promise.all(
    ['completed', 'processing', 'failed', 'needs review'].map((label) => outcomeCount(page, label)),
  );

  expect(completed + processing + failed + needsReview).toBe(total);
  expect(processing).toBe(0);

  // A batch is only useful if it opens into the records it produced.
  await page.getByRole('link', { name: 'Open in documents', exact: true }).click();

  await expect(page).toHaveURL(/\/documents\?.*batch=/);
  await expect(page.getByRole('grid', { name: 'Documents in the archive' })).toBeVisible();

  assertQuiet();
});

/**
 * Cancel used to create a batch for whatever had already arrived and open its
 * monitor, which answered "stop" by leaving the page.
 */
test('stays where it is when an upload is cancelled, whatever had arrived', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page, [INJECTED_UPLOAD_FAILURES]);

  await open(page, '/upload');
  await page.locator('input[type="file"][accept]').setInputFiles(LONG_RUN);
  await page.getByRole('button', { name: 'Start processing' }).click();

  // Something has to have got through, or there would be nothing to make a batch of.
  await expect(page.getByText('Sent', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  // Back to the selection, and still here a moment later.
  await expect(page.getByText('documents ready to upload')).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(page).toHaveURL(/\/upload$/);

  await page.getByRole('link', { name: 'Batches' }).click();
  await expect(page.getByText('No batches yet')).toBeVisible();

  assertQuiet();
});

/**
 * The page owns the queue. Left running after the operator had gone elsewhere,
 * it finished unseen and then pulled them to a batch they never watched begin.
 */
test('abandons an upload when the operator leaves the page', async ({ page }) => {
  await open(page, '/upload');
  await page.locator('input[type="file"][accept]').setInputFiles(selection.concat(LONG_RUN));
  await page.getByRole('button', { name: 'Start processing' }).click();
  await expect(page.getByRole('list', { name: 'Upload queue' })).toBeVisible();

  await page.getByRole('link', { name: 'Documents' }).click();
  await expect(page).toHaveURL(/\/documents/);

  // Long enough for the run to have finished, had it carried on.
  await page.waitForTimeout(12_000);
  await expect(page).toHaveURL(/\/documents/);

  await page.getByRole('link', { name: 'Batches' }).click();
  await expect(page.getByText('No batches yet')).toBeVisible();
});
