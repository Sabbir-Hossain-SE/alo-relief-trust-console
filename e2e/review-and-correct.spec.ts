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

/**
 * The two fields that are not free text.
 *
 * A phone number and a date are the values extraction gets wrong most often and
 * the ones a free-text box is worst at: it accepts a country code the operator
 * had to remember and a date in whatever order they happened to type it. This
 * walks the whole path — pick a country, type the digits, pick a day, and read
 * the result back out of the audit trail the archive kept.
 */
test('corrects a phone number and a date through their own controls', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  await open(page, '/review');
  await page
    .getByRole('list', { name: 'Review queue' })
    .getByRole('button', { name: /^Review / })
    .first()
    .click();

  const detail = page.getByRole('dialog', { name: 'Document detail' });

  // The archive's own country is already selected, so the common correction is
  // ten digits and nothing else.
  const country = detail.getByLabel('Phone country');
  await expect(country).toHaveText('BD +880');

  const phone = detail.getByLabel('Phone', { exact: true });
  await phone.fill('');
  await phone.pressSequentially('1712345678');

  // Typed one digit at a time on purpose: the field is controlled by the
  // stored E.164 string, and a round trip that put the calling code back into
  // the national half would grow the number by "880" on every keystroke.
  await expect(phone).toHaveValue('1712345678');

  const date = detail.getByRole('group', { name: 'Document date' });
  await date.getByRole('spinbutton', { name: 'Year' }).click();
  await page.keyboard.type('20240318');

  await detail.getByRole('button', { name: 'Save corrections' }).click();
  await expect(detail.getByRole('status')).toHaveText('Correction saved.', { timeout: 15_000 });

  // Stored in the one form the archive keeps, whatever country it came from.
  await expect(detail.getByText(/Phone:.*\+8801712345678/)).toBeVisible();
  await expect(detail.getByText(/Document date:.*2024-03-18/)).toBeVisible();

  assertQuiet();
});

/** The rules hold at the boundary, not only in the form. */
test('refuses a date the document could not carry', async ({ page }) => {
  await open(page, '/review');
  await page
    .getByRole('list', { name: 'Review queue' })
    .getByRole('button', { name: /^Review / })
    .first()
    .click();

  const detail = page.getByRole('dialog', { name: 'Document detail' });
  const date = detail.getByRole('group', { name: 'Document date' });

  await date.getByRole('spinbutton', { name: 'Year' }).click();
  await page.keyboard.type('20990101');
  await detail.getByLabel('Person name').click();

  await expect(detail.getByText('A document cannot be dated in the future')).toBeVisible();

  await detail.getByRole('button', { name: 'Save corrections' }).click();
  await expect(detail.getByRole('status')).toHaveCount(0);
});
