import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from '@playwright/test';

/**
 * Recaptures every screenshot the README links to.
 *
 * Written down rather than done by hand because the shell, the theme and the
 * pages all change, and a screenshot that is out of date is a claim the README
 * is making about a screen that no longer exists.
 *
 *   pnpm build && pnpm start --port 3100
 *   pnpm screenshots
 */
const BASE = process.env.SCREENSHOT_URL ?? 'http://127.0.0.1:3100';
const OUT = '.github/screenshots';
const VIEWPORT = { width: 1440, height: 900 };

/** Accepted formats, so nothing is rejected before it is queued. */
function files(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `intake-${i + 1}.pdf`,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% mock intake scan\n%%EOF\n'),
  }));
}

type Shot = {
  name: string;
  /** Drives the app to the state worth photographing. */
  reach: (page: Page) => Promise<void>;
};

async function open(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE}${path}`);
  await page.getByText('Preparing the archive…').waitFor({ state: 'detached', timeout: 30_000 });
}

async function chooseFiles(page: Page, count = 8): Promise<void> {
  await open(page, '/upload');
  await page.locator('input[type="file"][accept]').setInputFiles(files(count));
  await page.getByText('documents ready to upload').waitFor();
}

/**
 * Enough documents that the batch is still working when the monitor renders.
 *
 * A handful settles before the page has finished loading, which photographs a
 * finished batch on the screen meant to show one in flight.
 */
const IN_FLIGHT_COUNT = 150;

const SHOTS: Shot[] = [
  { name: 'overview', reach: (page) => open(page, '/') },
  { name: 'upload', reach: (page) => open(page, '/upload') },
  { name: 'upload-summary', reach: (page) => chooseFiles(page) },
  {
    name: 'upload-queue',
    reach: async (page) => {
      await chooseFiles(page, IN_FLIGHT_COUNT);
      await page.getByRole('button', { name: 'Start processing' }).click();
      await page.getByRole('progressbar', { name: 'Upload progress' }).waitFor();
    },
  },
  {
    name: 'batch-running',
    reach: async (page) => {
      await chooseFiles(page, IN_FLIGHT_COUNT);
      await page.getByRole('button', { name: 'Start processing' }).click();
      await page.getByRole('heading', { name: 'Batch in progress', level: 1 }).waitFor();
    },
  },
  {
    name: 'batch-settled',
    reach: async (page) => {
      await chooseFiles(page, IN_FLIGHT_COUNT);
      await page.getByRole('button', { name: 'Start processing' }).click();
      await page
        .getByRole('heading', { name: 'Batch complete', level: 1 })
        .waitFor({ timeout: 120_000 });
    },
  },
  {
    name: 'documents',
    reach: async (page) => {
      await open(page, '/documents');
      await page.getByRole('grid', { name: 'Documents in the archive' }).waitFor();
    },
  },
  {
    name: 'document-detail',
    reach: async (page) => {
      await open(page, '/documents?status=failed');
      await page.getByRole('grid', { name: 'Documents in the archive' }).waitFor();
      await page.getByRole('row').nth(1).click();
      await page.getByRole('dialog', { name: 'Document detail' }).waitFor();
    },
  },
  {
    name: 'review-queue',
    reach: async (page) => {
      await open(page, '/review');
      await page.getByRole('list', { name: 'Review queue' }).waitFor();
    },
  },
  {
    name: 'review-correction',
    reach: async (page) => {
      await open(page, '/review');
      await page
        .getByRole('list', { name: 'Review queue' })
        .getByRole('button', { name: /^Review / })
        .first()
        .click();
      await page.getByRole('dialog', { name: 'Document detail' }).waitFor();
    },
  },
];

async function capture(shot: Shot, scheme: 'light' | 'dark'): Promise<void> {
  const browser = await chromium.launch();
  // A fresh context per shot: the mock backend keeps one archive per context,
  // so an upload from an earlier shot would otherwise appear in a later one.
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: scheme });
  const page = await context.newPage();

  try {
    await shot.reach(page);
    // Long enough for the drawer and the progress bars to have settled.
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${shot.name}-${scheme}.png` });
    console.log(`captured ${shot.name}-${scheme}`);
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });

  for (const shot of SHOTS) {
    for (const scheme of ['light', 'dark'] as const) {
      await capture(shot, scheme);
    }
  }
}

// Called rather than awaited at the top level: tsx compiles this file to CJS,
// where a top-level await is a syntax error.
void main();
