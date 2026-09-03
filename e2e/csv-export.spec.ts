import { stat } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { failOnConsoleErrors, open } from './support/console';

/**
 * The way work leaves this console. An operator who has narrowed the archive to
 * the records they care about has to be able to take them somewhere else.
 */
test('exports the filtered view as a csv the operator actually receives', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  await open(page, '/documents?status=failed&cause=password_protected');
  await expect(page.getByRole('grid', { name: 'Documents in the archive' })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();

  // The button becomes the way out of the export it started, rather than
  // sitting disabled beside a second button that does the cancelling.
  await expect(page.getByRole('button', { name: 'Cancel export' })).toBeVisible();

  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^alo-relief-trust-documents-\d{4}-\d{2}-\d{2}\.csv$/);

  const text = await file.createReadStream().then(
    (stream) =>
      new Promise<string>((resolve) => {
        let out = '';
        stream.on('data', (chunk) => (out += chunk));
        stream.on('end', () => resolve(out));
      }),
  );

  const rows = text.replace(/^﻿/, '').trimEnd().split('\r\n');
  expect(rows[0]).toContain('ID,File name');
  expect(rows.length).toBeGreaterThan(1);

  // Exactly the filtered view, not the whole archive and not the page on screen.
  const reported = await page.getByRole('status').textContent();
  expect(reported).toMatch(/[\d,]+ documents exported\./);
  expect(Number((reported ?? '').replace(/\D/g, ''))).toBe(rows.length - 1);

  // Every exported row is a failure of the cause that was filtered for.
  expect(rows.slice(1).every((row) => row.includes('Failed'))).toBe(true);

  assertQuiet();
});

test('says nothing was saved rather than handing over an empty file', async ({ page }) => {
  await open(page, '/documents?q=zzzzz-no-such-record');
  await expect(page.getByText('No documents match these filters')).toBeVisible({ timeout: 15_000 });

  let downloaded = false;
  page.on('download', () => {
    downloaded = true;
  });

  await page.getByRole('button', { name: 'Export CSV' }).click();

  await expect(page.getByRole('status')).toHaveText(
    'Nothing matches these filters, so no file was saved.',
    { timeout: 20_000 },
  );
  expect(downloaded).toBe(false);
});

test('exports the whole 100,000-document archive, reporting progress as it goes', async ({
  page,
}) => {
  await open(page, '/documents');
  await expect(page.getByRole('grid', { name: 'Documents in the archive' })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();

  // The reason the response is read as a stream rather than awaited as a blob:
  // a multi-megabyte file has something to say while it is being prepared.
  await expect(page.getByRole('progressbar', { name: 'Preparing the export' })).toBeVisible();

  const file = await download;
  await expect(page.getByRole('status')).toHaveText('100,000 documents exported.', {
    timeout: 60_000,
  });

  const { size } = await stat(await file.path());
  expect(size).toBeGreaterThan(5_000_000);
});
