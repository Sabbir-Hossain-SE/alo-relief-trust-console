import { expect, test, type Locator, type Page } from '@playwright/test';
import { failOnConsoleErrors, open } from './support/console';

/** The shape and focus appearance of whatever currently has keyboard focus. */
type FocusState = {
  name: string;
  radius: string;
  /** An outline drawn on the focused element itself. */
  hasOwnRing: boolean;
  /** The 2px border an outlined field paints around the whole control. */
  hasFieldRing: boolean;
};

async function focusState(page: Page): Promise<FocusState> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (element === null) throw new Error('Nothing has focus.');

    const styles = getComputedStyle(element);
    const field = element.closest('.MuiInputBase-root')?.querySelector('fieldset');

    return {
      name:
        element.getAttribute('aria-label') ??
        element.textContent?.trim().slice(0, 30) ??
        element.tagName,
      radius: styles.borderRadius,
      hasOwnRing: styles.outlineStyle !== 'none' && parseFloat(styles.outlineWidth) > 0,
      hasFieldRing:
        field !== null && field !== undefined
          ? parseFloat(getComputedStyle(field).borderTopWidth) >= 2
          : false,
    };
  });
}

/** The element's resting shape, read before anything is focused. */
async function restingRadius(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).borderRadius);
}

/**
 * Moves keyboard focus onto a control the way an operator would.
 *
 * `locator.focus()` is not enough: `:focus-visible` does not match programmatic
 * focus on a button, so the ring under test would never be painted.
 */
async function tabTo(page: Page, locator: Locator): Promise<void> {
  await locator.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
}

/**
 * One ring per focus stop.
 *
 * An outlined field already draws a focus ring around the whole control. The
 * app's own `:focus-visible` rule used to draw a second one on the `input`
 * inside it, so the search box — which holds an icon, the text, and a clear
 * button — showed two rings of two different shapes, one nested in the other.
 */
test('draws one focus ring around the search control, not two', async ({ page }) => {
  const assertQuiet = failOnConsoleErrors(page);

  await open(page, '/documents');

  const search = page.getByRole('textbox', { name: 'Search documents' });
  await tabTo(page, search);

  const state = await focusState(page);
  expect(state.hasFieldRing).toBe(true);
  expect(state.hasOwnRing).toBe(false);

  // The ring belongs to the control, so the leading icon sits inside it. That
  // is the difference the two-ring version got wrong: its inner ring started
  // where the text did, leaving the icon out in a box of its own.
  const control = page.locator('.MuiOutlinedInput-root').first();
  const controlBox = await control.boundingBox();
  const inputBox = await search.boundingBox();
  expect(controlBox?.x).toBeLessThan(inputBox?.x ?? 0);

  assertQuiet();
});

/**
 * A select with no outline of its own still has to show focus, which is why the
 * suppression above is scoped to outlined fields rather than to every input.
 */
test('keeps a ring on the rows-per-page select, which draws none of its own', async ({ page }) => {
  await open(page, '/documents');

  const rowsPerPage = page.getByRole('combobox', { name: 'Rows per page:' });
  await tabTo(page, rowsPerPage);

  const state = await focusState(page);
  expect(state.hasFieldRing).toBe(false);
  expect(state.hasOwnRing).toBe(true);
});

/**
 * Focus is an outline, never a reshape.
 *
 * The rule set `border-radius` alongside the outline, meaning to round the ring
 * — but that property reshapes the element, not the outline around it. Every
 * control whose resting shape was not 6px changed shape on focus.
 */
const SHAPES = [
  {
    what: 'the circular icon button in the bar',
    find: (page: Page) => page.getByRole('button', { name: /Switch to (dark|light) theme/ }),
  },
  {
    what: 'a pill-shaped navigation item',
    find: (page: Page) => page.getByRole('link', { name: 'Documents' }),
  },
  {
    what: 'one end of the density toggle',
    find: (page: Page) => page.getByRole('button', { name: 'Comfortable rows' }),
  },
];

for (const { what, find } of SHAPES) {
  test(`does not reshape ${what} when it takes focus`, async ({ page }) => {
    await open(page, '/documents');

    const control = find(page);
    const resting = await restingRadius(control);

    await tabTo(page, control);
    const state = await focusState(page);

    expect(state.radius).toBe(resting);
    expect(state.hasOwnRing).toBe(true);
  });
}

/**
 * The two fields in the filter row are one row of controls, so they have to
 * read as one. The search box carried a placeholder and the type filter a
 * floating label, so choosing a type grew a heading on that field while the
 * other never had one.
 */
test('holds both filter labels open, empty or filled', async ({ page }) => {
  await open(page, '/documents');

  const search = page.getByRole('textbox', { name: 'Search documents' });
  const type = page.getByRole('combobox', { name: 'Type' });

  // MUI renders the text field's label as a `label` and the select's as a
  // `div`, since a `label` cannot name a `div[role="combobox"]`. The class is
  // what the two have in common.
  const labels = page.locator('.MuiInputLabel-root');
  await expect(labels).toHaveText(['Search', 'Type']);

  const boxes = async () => Promise.all([labels.nth(0).boundingBox(), labels.nth(1).boundingBox()]);

  const [searchLabel, typeLabel] = await boxes();

  // Held open, both of them, on one line.
  expect(searchLabel?.y).toBe(typeLabel?.y);
  await expect(type).toHaveText('All types');

  await search.fill('Fatima');
  await type.click();
  await page.getByRole('option', { name: 'ID scan' }).click();
  await expect(page).toHaveURL(/type=id_scan/);
  await expect(type).toHaveText('ID scan');

  // Nothing in the row moves as it fills. The floating label used to travel up
  // into the border on the type filter alone.
  const [searchAfter, typeAfter] = await boxes();
  expect(searchAfter).toEqual(searchLabel);
  expect(typeAfter).toEqual(typeLabel);
});

/** Escape is the keyboard's version of the clear button. */
test('clears the search on Escape', async ({ page }) => {
  await open(page, '/documents');

  const search = page.getByRole('textbox', { name: 'Search documents' });
  await search.fill('Fatima');
  await expect(page).toHaveURL(/q=Fatima/);

  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(page).not.toHaveURL(/q=Fatima/);
});
