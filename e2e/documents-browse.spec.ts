import { expect, test } from '@playwright/test';
import { failOnConsoleErrors, open } from './support/console';

/**
 * The archive is 100,000 documents, so the whole screen is a filter: narrow it,
 * open one record, and be able to send someone else the same view.
 */
test('filters the archive, opens a record, and keeps the view in the URL', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  await open(page, '/documents');
  await expect(page.getByRole('heading', { name: 'Documents', level: 1 })).toBeVisible();

  const grid = page.getByRole('grid', { name: 'Documents in the archive' });
  await expect(grid.getByRole('row').nth(1)).toBeVisible();

  await page
    .getByRole('group', { name: 'Filter by status' })
    .getByRole('button', { name: 'Failed' })
    .click();

  // View state lives in the URL, which is what makes a filtered screen
  // shareable and survives a refresh.
  await expect(page).toHaveURL(/status=failed/);

  const firstRow = grid.getByRole('row').nth(1);
  await expect(firstRow).toBeVisible();
  await expect(firstRow.getByText('Failed')).toBeVisible();

  await firstRow.click();

  const detail = page.getByRole('dialog', { name: 'Document detail' });
  await expect(detail).toBeVisible();
  // A failure names a way out rather than an error code — and which way out
  // depends on whether a second attempt could ever succeed.
  await expect(
    detail.getByRole('button', { name: /^(Retry|Enter by hand)$/ }).first(),
  ).toBeVisible();

  // The open record is in the URL too, so one document can be linked to.
  await expect(page).toHaveURL(/doc=/);
  const shared = page.url();

  // The drawer is modal, so Escape closes it.
  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();

  // The whole point of putting it in the URL: someone else opens the same view.
  await open(page, shared);
  const reopened = page.getByRole('dialog', { name: 'Document detail' });
  await expect(reopened).toBeVisible();

  // The filters behind it can only be read once the modal releases the page.
  await reopened.getByRole('button', { name: 'Close detail' }).click();
  await expect(reopened).toBeHidden();
  await expect(
    page.getByRole('group', { name: 'Filter by status' }).getByRole('button', { name: 'Failed' }),
  ).toHaveAttribute('aria-pressed', 'true');

  assertQuiet();
});

test('keeps confidence and status as separate filters', async ({ page }) => {
  await open(page, '/documents');

  // These chips sat in the status group once, so every confidence filter was
  // announced as a status filter.
  await page
    .getByRole('group', { name: 'Filter by confidence' })
    .getByRole('button', { name: 'Low confidence' })
    .click();

  await expect(page).toHaveURL(/confidence=low/);
  await expect(page).not.toHaveURL(/status=/);

  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(page).not.toHaveURL(/confidence=/);
});

test('reports a search that matches nothing as a filter problem', async ({ page }) => {
  await open(page, '/documents');

  await page.getByRole('textbox', { name: 'Search documents' }).fill('zzzzz-no-such-record');

  // An archive with nothing in it and a filter matching nothing are different
  // problems, and only one of them is solved by clearing filters.
  await expect(page.getByText('No documents match these filters')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/q=zzzzz-no-such-record/);

  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(page.getByRole('grid', { name: 'Documents in the archive' })).toBeVisible();
});
