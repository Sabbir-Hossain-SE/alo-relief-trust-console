import { expect, test, type Page } from '@playwright/test';
import { failOnConsoleErrors, open } from './support/console';

/** The y-coordinate of a locator, for asking whether two things share a line. */
async function topOf(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).boundingBox();
  return Math.round(box?.y ?? -1);
}

/**
 * Wide enough, every filter is a target rather than something to open.
 *
 * The two chip groups used to take a line each under the search, so the bar
 * stood three rows deep before a single document was visible. They share one
 * line now, and the line does not wrap: a filter set that changes height as it
 * is used moves the grid under the pointer.
 */
test('keeps every filter chip on one line on a desktop width', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, '/documents');

  const status = page.getByRole('group', { name: 'Filter by status' });
  const confidence = page.getByRole('group', { name: 'Filter by confidence' });

  await expect(status).toBeVisible();
  await expect(confidence).toBeVisible();
  expect(await topOf(page, '[aria-label="Filter by status"]')).toBe(
    await topOf(page, '[aria-label="Filter by confidence"]'),
  );

  // Selecting one must not reflow the bar; the grid stays where it was.
  const gridBefore = await topOf(page, '.MuiDataGrid-root');
  await status.getByRole('button', { name: 'Failed' }).click();
  await expect(page).toHaveURL(/status=failed/);
  expect(await topOf(page, '.MuiDataGrid-root')).toBe(gridBefore);

  assertQuiet();
});

/**
 * The confidence chips read "High" so they fit, and are still announced in full
 * — the group's own name is not repeated onto each chip by a screen reader, and
 * "High" alone names nothing an operator could act on.
 */
test('shortens the confidence chips without shortening their names', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, '/documents');

  const confidence = page.getByRole('group', { name: 'Filter by confidence' });
  await expect(confidence.getByRole('button', { name: 'Low confidence' })).toHaveText('Low');
  await confidence.getByRole('button', { name: 'Low confidence' }).click();
  await expect(page).toHaveURL(/confidence=low/);
});

/**
 * On a phone the same chips laid down the page cost a third of the screen
 * before a row of the archive was visible, so they move into a sheet.
 */
test('collapses the filters into a sheet on a phone', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/documents');

  // The chips are gone from the page, not merely hidden: two copies would put
  // two groups of the same name into the accessibility tree.
  await expect(page.getByRole('group', { name: 'Filter by status' })).toHaveCount(0);

  const search = page.getByRole('textbox', { name: 'Search documents' });
  await expect(search).toBeVisible();

  await page.getByRole('button', { name: 'Filters' }).click();
  const sheet = page.getByRole('dialog', { name: 'Filters' });
  await expect(sheet).toBeVisible();

  await sheet
    .getByRole('group', { name: 'Filter by status' })
    .getByRole('button', { name: 'Failed' })
    .click();
  await expect(page).toHaveURL(/status=failed/);

  // Applied as it is set rather than on a confirm step, so the button that
  // closes the sheet shows results instead of pretending to apply them.
  await sheet.getByRole('button', { name: 'Show results' }).click();
  await expect(sheet).toBeHidden();

  assertQuiet();
});

/** What is on, without opening anything, and one tap to take it off. */
test('lists the filters applied, and removes one from the chip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/documents?status=failed&confidence=low');

  const applied = page.getByRole('group', { name: 'Filters applied' });
  await expect(applied.getByText('Failed')).toBeVisible();
  await expect(applied.getByText('Low confidence')).toBeVisible();

  await applied.getByRole('button', { name: 'Failed — remove filter' }).click();

  await expect(page).not.toHaveURL(/status=failed/);
  await expect(page).toHaveURL(/confidence=low/);
  await expect(applied.getByText('Low confidence')).toBeVisible();
});

/** The sheet is a dialog, so it has to behave like one. */
test('traps and restores focus around the sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/documents');

  const trigger = page.getByRole('button', { name: 'Filters' });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close filters' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Filters' })).toBeHidden();
  await expect(trigger).toBeFocused();
});
