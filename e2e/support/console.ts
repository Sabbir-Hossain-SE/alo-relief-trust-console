import { expect, type Page } from '@playwright/test';

/**
 * Opens a page and waits for the mock backend to be intercepting.
 *
 * The archive is generated in the browser behind a service worker, so every
 * screen shows "Preparing the archive…" first. Asserting against the page
 * before that clears is the single largest source of flake in this suite.
 */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByText('Preparing the archive…')).toHaveCount(0, { timeout: 30_000 });
}

/**
 * Fails the test if the page logs an error or throws.
 *
 * "Browser console free of errors" is in the definition of done, and an
 * assertion is the only thing that keeps it true once nobody is watching.
 *
 * `allow` is matched against the message and the URL it came from, for the
 * failures this prototype injects on purpose. Nothing else belongs in it: a
 * pattern here is a claim that the console noise is the product working.
 */
export function failOnConsoleErrors(page: Page, allow: readonly RegExp[] = []): () => void {
  const problems: string[] = [];

  const permitted = (line: string) => allow.some((pattern) => pattern.test(line));

  page.on('console', (message) => {
    if (message.type() !== 'error') return;

    const line = `${message.text()} ${message.location().url}`;
    if (!permitted(line)) problems.push(`console.error: ${line}`);
  });

  page.on('pageerror', (error) => {
    problems.push(`uncaught: ${error.message}`);
  });

  return () => expect(problems).toEqual([]);
}

/**
 * The upload endpoint rejects a share of requests with a 503 by design, so the
 * queue's backoff and retry are exercised against something real. The browser
 * logs every one of them.
 */
export const INJECTED_UPLOAD_FAILURES = /status of 503 .*\/api\/uploads$/;
