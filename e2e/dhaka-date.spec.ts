import { expect, test } from '@playwright/test';
import { failOnConsoleErrors, open } from './support/console';

/**
 * The archive is worked from Dhaka, six hours ahead of UTC. At half past two
 * in the morning there it is already the 4th, while UTC is still on the 3rd —
 * and a check made against UTC midnight refused a document dated the day it
 * was actually filed as being from the future.
 */
test.use({ timezoneId: 'Asia/Dhaka' });

test('accepts today s date in the small hours of a Dhaka morning', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  // 2026-09-03T20:30Z is 02:30 on 2026-09-04 in Dhaka.
  await page.clock.setFixedTime(new Date('2026-09-03T20:30:00Z'));

  await open(page, '/review');
  await page
    .getByRole('list', { name: 'Review queue' })
    .getByRole('button', { name: /^Review / })
    .first()
    .click();

  const detail = page.getByRole('dialog', { name: 'Document detail' });
  const date = detail.getByRole('group', { name: 'Document date' });

  await date.getByRole('spinbutton', { name: 'Year' }).click();
  await page.keyboard.type('20260904');
  await detail.getByLabel('Person name').click();

  await expect(detail.getByText('A document cannot be dated in the future')).toHaveCount(0);

  await detail.getByRole('button', { name: 'Save corrections' }).click();
  await expect(detail.getByRole('status')).toHaveText('Correction saved.', { timeout: 15_000 });
  await expect(detail.getByText(/Document date:.*2026-09-04/)).toBeVisible();

  assertQuiet();
});
