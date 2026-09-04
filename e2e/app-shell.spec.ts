import { expect, test, type Page } from '@playwright/test';
import { failOnConsoleErrors, open } from './support/console';

/**
 * The rail's width once it has stopped moving.
 *
 * The collapse is animated, so a measurement taken straight after the click
 * catches the transition part way through and reads as a number that was never
 * a resting state. Polled until two reads agree rather than slept on, so a
 * machine that animates faster does not pay for one that animates slower.
 */
async function settledRailWidth(page: Page): Promise<number> {
  const read = async () => (await page.locator('#main-navigation').boundingBox())?.width ?? 0;

  let previous = -1;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const width = await read();
    if (width === previous) return width;

    previous = width;
    await page.waitForTimeout(50);
  }

  throw new Error('The navigation rail never settled on a width.');
}

/**
 * The shell: one bar across the top of everything, and a rail underneath it
 * that an operator can narrow when the screen is worth more than the labels.
 */
test('spans the bar across the full width, with the rail below it', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  await open(page, '/documents');

  const bar = page.getByRole('banner');
  const barBox = await bar.boundingBox();
  const viewport = page.viewportSize();

  // Full width means exactly that: it starts at the left edge and runs the
  // whole way, rather than beginning where the navigation ends.
  expect(barBox?.x).toBe(0);
  expect(barBox?.width).toBe(viewport?.width);

  const navBox = await page.locator('#main-navigation').boundingBox();
  expect(navBox?.y).toBeGreaterThanOrEqual((barBox?.y ?? 0) + (barBox?.height ?? 0));
  expect(navBox?.x).toBe(0);

  assertQuiet();
});

test('collapses the rail to icons and back', async ({ page }) => {
  await open(page, '/documents');

  const expanded = await settledRailWidth(page);
  expect(expanded).toBeGreaterThan(200);

  await page.getByRole('button', { name: 'Collapse navigation' }).click();

  const collapsed = await settledRailWidth(page);
  expect(collapsed).toBeLessThan(expanded);
  expect(collapsed).toBeGreaterThan(0);

  // Every link keeps its name: a collapsed label is hidden visually, not
  // removed, or five links would be named by an icon alone.
  await expect(page.getByRole('link', { name: 'Review queue' })).toBeVisible();

  const toggle = page.getByRole('button', { name: 'Expand navigation' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  expect(await settledRailWidth(page)).toBe(expanded);
});

// It is a preference, not view state: it belongs to the operator rather than to
// the screen, so it does not go in the URL and it does not reset on reload.
test('remembers the choice across navigation and reload', async ({ page }) => {
  await open(page, '/documents');
  await page.getByRole('button', { name: 'Collapse navigation' }).click();

  const collapsed = await settledRailWidth(page);

  await page.getByRole('link', { name: 'Batches' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await settledRailWidth(page)).toBe(collapsed);

  await open(page, '/review');
  await expect(page.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
  expect(await settledRailWidth(page)).toBe(collapsed);
});

/**
 * The server cannot see the preference, so it renders the rail expanded. Left
 * to React, the collapsed width arrived two renders after hydration and the
 * rail was drawn wide and then animated shut on every load. An inline script
 * now marks the document before the first paint, and the rail is laid out
 * from that mark.
 */
test('paints a collapsed rail at its collapsed width from the first frame', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  // Records every width the rail is ever laid out at, from the moment it exists.
  await page.addInitScript(() => {
    const widths: number[] = [];
    (window as unknown as { __railWidths: number[] }).__railWidths = widths;

    const watch = () => {
      const rail = document.getElementById('main-navigation');
      if (rail === null) return false;

      new ResizeObserver((entries) => {
        for (const entry of entries) widths.push(entry.contentRect.width);
      }).observe(rail);

      return true;
    };

    // Observed on the document: at this point in the load the <html> element
    // itself may not have been parsed yet.
    if (!watch()) {
      new MutationObserver((_mutations, observer) => {
        if (watch()) observer.disconnect();
      }).observe(document, { childList: true, subtree: true });
    }
  });

  await open(page, '/documents');
  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  const collapsed = await settledRailWidth(page);

  await open(page, '/documents');
  await expect(page.getByRole('button', { name: 'Expand navigation' })).toBeVisible();

  const seen = await page.evaluate(
    () => (window as unknown as { __railWidths: number[] }).__railWidths,
  );

  expect(seen.length).toBeGreaterThan(0);
  // Never wider than its resting width: no frame of the expanded rail, and no
  // animation from one to the other.
  expect(Math.max(...seen)).toBeLessThanOrEqual(collapsed);

  assertQuiet();
});

test('opens the navigation as a drawer on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await open(page, '/documents');

  // There is no rail to narrow at this width, so the bar offers the drawer.
  await expect(page.getByRole('button', { name: 'Collapse navigation' })).toBeHidden();

  await page.getByRole('button', { name: 'Open navigation' }).click();

  const drawer = page.getByRole('presentation').filter({ has: page.getByRole('navigation') });
  await expect(drawer.getByRole('link', { name: 'Review queue' })).toBeVisible();

  await page.getByRole('link', { name: 'Batches' }).click();
  await expect(page).toHaveURL(/\/batches$/);
});
