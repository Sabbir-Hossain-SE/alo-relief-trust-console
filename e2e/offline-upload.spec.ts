import { expect, test } from '@playwright/test';
import { INJECTED_UPLOAD_FAILURES, failOnConsoleErrors, open } from './support/console';

/** Enough files that the queue is still running when the connection drops. */
const FILE_COUNT = 60;

const PDF = Buffer.from('%PDF-1.4\n% mock intake scan\n%%EOF\n');

const selection = Array.from({ length: FILE_COUNT }, (_, i) => ({
  name: `intake-${i + 1}.pdf`,
  mimeType: 'application/pdf',
  buffer: PDF,
}));

/**
 * A wireless drop of half a minute used to fail a hundred files for good: six
 * in flight, three attempts each, a few seconds of backoff. The queue now waits
 * out the outage and carries on from where it was.
 */
test('pauses the queue while offline and resumes when the connection returns', async ({
  page,
  context,
}) => {
  const assertQuiet = failOnConsoleErrors(page, [INJECTED_UPLOAD_FAILURES]);

  await open(page, '/upload');
  await page.locator('input[type="file"][accept]').setInputFiles(selection);
  await expect(page.getByText('documents ready to upload')).toBeVisible();

  await page.getByRole('button', { name: 'Start processing' }).click();
  await expect(page.getByRole('list', { name: 'Upload queue' })).toBeVisible();

  await context.setOffline(true);

  // Paused without anyone asking, so it says why.
  await expect(page.getByText('paused until the connection comes back')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();

  await context.setOffline(false);

  await expect(page.getByText('paused until the connection comes back')).toHaveCount(0);
  await expect(page).toHaveURL(/\/batches\/[^/?]+$/, { timeout: 60_000 });

  assertQuiet();
});
