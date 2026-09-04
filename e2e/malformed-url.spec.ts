import { expect, test } from '@playwright/test';
import { failOnConsoleErrors, open } from './support/console';

/**
 * The view state lives in the URL, which means anyone can type it.
 *
 * That is the price of a screen you can share, and it makes the query string an
 * untrusted input like any other. `?pageSize=200` passed the query schema, was
 * served by the backend, and then threw inside the grid — MUI X refuses a page
 * larger than its licence allows rather than clamping — which unmounted the
 * whole route and left the browser's own error page.
 */
const MALFORMED = [
  '?pageSize=200',
  '?pageSize=101',
  '?pageSize=37',
  '?pageSize=0',
  '?pageSize=-5',
  '?pageSize=abc',
  '?page=ewerw',
  '?page=-1',
  '?page=1.5',
  '?page=99999',
  '?status=bogus',
  '?status=completed&status=bogus',
  '?type=bogus',
  '?confidence=bogus',
  '?sort=bogus&dir=sideways',
  '?sort=bogus&dir=asc',
  '?cause=bogus',
  '?doc=',
  '?doc=%20',
];

for (const query of MALFORMED) {
  test(`survives ${query}`, async ({ page }) => {
    const assertQuiet = failOnConsoleErrors(page);

    await open(page, `/documents${query}`);

    // The page is still the page: heading, filters and a grid with rows in it.
    await expect(page.getByRole('heading', { name: 'Documents', level: 1 })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search documents' })).toBeVisible();

    const grid = page.getByRole('grid', { name: 'Documents in the archive' });
    await expect(grid).toBeVisible();
    await expect(grid.getByRole('row').nth(1)).toBeVisible();

    assertQuiet();
  });
}

/**
 * A link saved before a status was renamed carries one value the schema no
 * longer knows beside the ones it still does. Failing the whole query showed
 * the entire archive under a filter bar that said nothing was applied.
 */
test('keeps the filters it can read beside one it cannot', async ({ page }) => {
  await open(page, '/documents?status=completed&status=bogus&type=id_scan&q=rah');

  await expect(page.getByRole('button', { name: 'Completed', pressed: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search documents' })).toHaveValue('rah');
  await expect(page.getByRole('combobox', { name: 'Type' })).toHaveText('ID scan');
});

/** A page size the grid cannot render falls back to one it can. */
test('serves a page it can show when the address asks for one it cannot', async ({ page }) => {
  await open(page, '/documents?pageSize=200');

  const rowsPerPage = page.getByRole('combobox', { name: 'Rows per page:' });
  await expect(rowsPerPage).toHaveText('50');
});

/**
 * A link to a record that is no longer there says so, rather than opening an
 * empty panel or quietly doing nothing.
 */
test('explains a deep link to a document that is not in the archive', async ({ page }) => {
  await open(page, '/documents?doc=ARC-999999');

  const detail = page.getByRole('dialog', { name: 'Document detail' });
  await expect(detail).toBeVisible();
  await expect(detail.getByText('This document is not in the archive')).toBeVisible();
  // A record that is not there is not helped by asking again, and the answer
  // is final: no retry, and no skeleton left waiting for details that will
  // never come.
  await expect(detail.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(detail.locator('.MuiSkeleton-root')).toHaveCount(0);
});

/**
 * The ID column is not a sort the query engine performs. Offered anyway, the
 * click wrote a sort the server dropped and the header arrows described an
 * order the rows were not in.
 */
test('does not offer a sort the archive cannot perform', async ({ page }) => {
  await open(page, '/documents');

  await page.getByRole('columnheader', { name: 'ID', exact: true }).click();

  await expect(page).not.toHaveURL(/sort=/);
  await expect(page.getByRole('columnheader', { name: 'Uploaded' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
});

/** The same for a batch, which is a whole route rather than a panel. */
test('explains a link to a batch that is not there', async ({ page }) => {
  await open(page, '/batches/does-not-exist');

  await expect(page.getByText('That batch is not here')).toBeVisible();
  // The navigation survives, so there is somewhere to go from here.
  await expect(page.getByRole('link', { name: 'Documents' })).toBeVisible();
});
