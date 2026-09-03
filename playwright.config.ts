import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * End-to-end configuration.
 *
 * Runs against a production build rather than the dev server: the mock backend
 * is a service worker, and the thing worth proving is that it registers and
 * intercepts in the artefact that actually ships. `next dev` recompiles on first
 * request, which shows up as flake rather than as a slow test.
 */
export default defineConfig({
  testDir: './e2e',
  // The mock backend keeps one in-memory archive per browser context, so files
  // are independent but the specs inside one file share nothing either way.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // Built rather than served from `.next` as found: a stale build is the one
    // failure mode that makes an E2E suite lie.
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
