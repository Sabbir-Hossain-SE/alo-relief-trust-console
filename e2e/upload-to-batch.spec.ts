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
