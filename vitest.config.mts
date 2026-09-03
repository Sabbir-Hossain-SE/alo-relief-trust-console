import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domain/**', 'src/lib/**', 'src/server/**'],
      exclude: [
        // The service-worker boot. `setupWorker` throws outside a browser, so
        // there is nothing jsdom can assert about it — it is covered by the
        // Playwright suite, which cannot reach a screen until it has run.
        'src/server/browser.ts',
        'src/server/MockApiProvider.tsx',
      ],
      /**
       * Held rather than merely reported.
       *
       * `domain/` is the status machine, the confidence bands, the error
       * taxonomy and the record model: framework-free, pure, and the place a
       * regression is cheapest to catch, so it is kept whole. `lib/` carries
       * the upload queue and the folder walk, whose remaining gaps are
       * defensive branches rather than behaviour. The mock backend is a
       * fixture, and is held to a lower bar on purpose.
       */
      thresholds: {
        'src/domain/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/lib/**': { statements: 96, branches: 90, functions: 92, lines: 96 },
        statements: 94,
        branches: 90,
        functions: 95,
        lines: 96,
      },
    },
  },
});
