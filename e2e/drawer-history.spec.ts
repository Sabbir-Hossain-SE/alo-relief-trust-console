import { expect, test } from '@playwright/test';
import { open } from './support/console';

/**
 * Opening a record pushes, so Back closes it. Closing pushed as well, which
 * put the closed view on top of the open one: Back then reopened the drawer
 * that had just been dismissed.
 */
test('does not reopen a closed record on Back', async ({ page }) => {
  await open(page, '/documents');

  const grid = page.getByRole('grid', { name: 'Documents in the archive' });
  await grid.getByRole('row').nth(1).click();

  const detail = page.getByRole('dialog', { name: 'Document detail' });
  await expect(detail).toBeVisible();
  await expect(page).toHaveURL(/doc=/);

  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();
  await expect(page).not.toHaveURL(/doc=/);

  await page.goBack();

  await expect(page).not.toHaveURL(/doc=/);
  await expect(detail).toBeHidden();
});

/**
 * A cause arrives from the overview's failure breakdown. It narrowed the grid
 * to a few hundred rows under a filter bar that said nothing was applied, and
 * with "Clear filters" gone there was no way back to the archive.
 */
test('counts a failure cause as a filter that can be cleared', async ({ page }) => {
  await open(page, '/documents?cause=unreadable_scan');

  const clear = page.getByRole('button', { name: 'Clear filters' });
  await expect(clear).toBeVisible();
  await clear.click();

  await expect(page).not.toHaveURL(/cause=/);
  await expect(page.getByText(/of 100,000/)).toBeVisible({ timeout: 15_000 });
});
