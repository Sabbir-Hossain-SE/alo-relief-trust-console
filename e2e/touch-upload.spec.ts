import { devices, expect, test } from '@playwright/test';
import { failOnConsoleErrors, open } from './support/console';

/**
 * A phone has no window to drag a file out of, and its picker hands back files
 * however the input is marked. The screen offers what the device can do.
 */
test.use({ ...devices['Pixel 7'] });

test('offers files, not a folder or a drop, on a phone', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  await open(page, '/upload');

  await expect(page.getByText('Choose documents to upload')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose files' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose a folder' })).toHaveCount(0);

  assertQuiet();
});
