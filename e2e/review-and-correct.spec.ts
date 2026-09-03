import { expect, test } from '@playwright/test';
import { failOnConsoleErrors, open } from './support/console';

/**
 * The reason this is a console rather than a dashboard: an operator has to be
 * able to resolve an uncertain record, not merely be told it is uncertain.
 */
test('works a record out of the review queue by correcting it', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  await open(page, '/review');
  await expect(page.getByRole('heading', { name: 'Review queue', level: 1 })).toBeVisible();

  const queue = page.getByRole('list', { name: 'Review queue' });
  const first = queue.getByRole('button', { name: /^Review / }).first();
  await expect(first).toBeVisible();
  await first.click();

  // A review task opens ready to be worked on, because that is the only reason
  // it is in front of an operator.
  const detail = page.getByRole('dialog', { name: 'Document detail' });
  const personName = detail.getByRole('textbox', { name: 'Person name' });
  await expect(personName).toBeVisible();

  // Nothing has been changed yet, so there is nothing to save.
  const save = detail.getByRole('button', { name: 'Save corrections' });
  await expect(save).toBeDisabled();

  await personName.fill('Rahima Khatun');
  await expect(save).toBeEnabled();
  await save.click();

  // Every action says what it did; a silent button gets clicked twice.
  await expect(detail.getByRole('status')).toHaveText('Correction saved.', { timeout: 15_000 });

  // Asserted through the audit trail rather than the input, because resolving
  // the last uncertain field takes the record out of review and the form with
  // it. An operator's correction is trusted absolutely either way.
  await expect(detail.getByText(/Person name:.*Rahima Khatun/)).toBeVisible();
  await expect(detail.getByText('Corrected').first()).toBeVisible();

  assertQuiet();
});

test('confirms an uncertain record rather than changing it', async ({ page }) => {
  await open(page, '/review');

  await page
    .getByRole('list', { name: 'Review queue' })
    .getByRole('button', { name: /^Review / })
    .first()
    .click();

  const detail = page.getByRole('dialog', { name: 'Document detail' });

  // The pipeline is often merely unsure rather than wrong, and the wording has
  // to say which claim the operator is actually making.
  const confirm = detail.getByRole('button', {
    name: /^(These values are correct|Nothing more on the page)$/,
  });
  await expect(confirm).toBeVisible();
  await confirm.click();

  await expect(detail.getByRole('status')).toHaveText('Correction saved.', { timeout: 15_000 });

  // Confirming is recorded as a correction, so the audit trail shows a person
  // checked it instead of the flag quietly disappearing.
  await expect(detail.getByText('Corrections', { exact: true })).toBeVisible();
});

test('reaches a queue item and its record from the keyboard alone', async ({ page }) => {
  await open(page, '/review');

  const queue = page.getByRole('list', { name: 'Review queue' });
  const rows = queue.getByRole('button', { name: /^Review / });
  await expect(rows.first()).toBeVisible();

  const second = await rows.nth(1).getAttribute('aria-label');

  // The list keeps one tab stop and the arrow keys move it, so a 200-item queue
  // does not cost an operator a tab press per row.
  await rows.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(queue.getByRole('button', { name: second ?? '' })).toBeFocused();

  await page.keyboard.press('Enter');

  await expect(page.getByRole('dialog', { name: 'Document detail' })).toBeVisible();
  await expect(page).toHaveURL(/doc=/);
});
