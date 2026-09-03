import { expect, test } from '@playwright/test';
import { failOnConsoleErrors, open } from './support/console';

/** Reads the count off a breakdown row's own accessible name. */
function countIn(name: string): number {
  return Number((name.match(/^[\d,]+/)?.[0] ?? '').replace(/,/g, ''));
}

/**
 * The overview answers three questions the status counts cannot: how certain
 * the pipeline was, why documents failed, and what the archive is made of.
 */
test('breaks the archive down and opens the documents behind each figure', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  await open(page, '/');
  await expect(page.getByRole('heading', { name: 'Archive breakdown', level: 2 })).toBeVisible();

  for (const card of ['Confidence', 'Why documents fail', 'Documents by type']) {
    await expect(page.getByRole('heading', { name: card, level: 3 })).toBeVisible();
  }

  // Confidence is reported over extracted documents only: a pending or failed
  // document is stored at zero, and averaging those in would understate the
  // pipeline. The caption has to say so rather than leave it implied.
  await expect(page.getByText(/Across [\d,]+ extracted documents · average \d+%/)).toBeVisible();

  const row = page.getByRole('link', { name: /high confidence — open in documents$/ });
  const label = (await row.getAttribute('aria-label')) ?? '';
  const expected = countIn(label);

  expect(expected).toBeGreaterThan(0);
  await row.click();

  // The figure and the screen it opens have to agree, or the tile sends an
  // operator somewhere they did not ask to go.
  await expect(page).toHaveURL(/confidence=high/);
  await expect(page).toHaveURL(/status=completed/);

  const grid = page.getByRole('grid', { name: 'Documents in the archive' });
  await expect(grid).toBeVisible();
  await expect(page.getByText(new RegExp(`of ${expected.toLocaleString('en-GB')}\\b`))).toBeVisible(
    {
      timeout: 15_000,
    },
  );

  assertQuiet();
});

test('opens one cause of failure from the overview', async ({ page }) => {
  await open(page, '/');

  const cause = page
    .getByRole('link', { name: /— open in documents$/ })
    .filter({ hasText: /scan|timed out|density|format|large|password|network/i })
    .first();

  await expect(cause).toBeVisible();
  await cause.click();

  await expect(page).toHaveURL(/status=failed/);
  await expect(page).toHaveURL(/cause=/);
  await expect(page.getByRole('grid', { name: 'Documents in the archive' })).toBeVisible();
});
