import { expect, test, type Page } from '@playwright/test';
import { failOnConsoleErrors, open } from './support/console';

/**
 * Dispatches a drag event with a file in it and reports whether the page
 * refused it. A synthetic drop cannot make the browser navigate, so the thing
 * that can be asserted is the thing that stops it: the default being cancelled.
 */
async function isRefused(
  page: Page,
  selector: string,
  type: 'dragover' | 'drop',
): Promise<boolean> {
  return page.evaluate(
    ([selector, type]) => {
      const target = document.querySelector(selector);
      if (target === null) throw new Error(`No element matches ${selector}`);

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File(['%PDF-1.4'], 'scan.pdf', { type: 'application/pdf' }));

      const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer });
      return !target.dispatchEvent(event);
    },
    [selector, type] as const,
  );
}

/**
 * A file dropped anywhere but the drop zone would open in place of the
 * console — and with it goes an archive that lives in memory and every batch
 * of the session. The shell refuses such drops on every screen.
 */
test('refuses a file dropped on the page outside a drop zone', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  await open(page, '/documents');

  expect(await isRefused(page, 'main', 'dragover')).toBe(true);
  expect(await isRefused(page, 'main', 'drop')).toBe(true);

  assertQuiet();
});

test('still lets the drop zone take a drop', async ({ page }) => {
  await open(page, '/upload');

  // The zone cancels the default too — that is what makes it a drop target —
  // and then indexes what it was given rather than ignoring it.
  expect(await isRefused(page, '[data-drop-target]', 'dragover')).toBe(true);
  expect(await isRefused(page, '[data-drop-target]', 'drop')).toBe(true);

  await expect(page.getByText(/document ready to upload/)).toBeVisible();
});
