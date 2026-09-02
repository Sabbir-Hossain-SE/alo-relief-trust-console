let started: Promise<void> | null = null;

/**
 * Starts the mock backend, once.
 *
 * `msw/browser` is imported lazily rather than at module scope: `setupWorker`
 * throws outside a browser, which breaks the production prerender as soon as
 * anything in the server render graph imports this file.
 *
 * The promise is cached rather than guarded by a boolean, so concurrent callers
 * all await the same startup instead of racing it. Nothing may issue a request
 * before it resolves, or the worker will not yet be intercepting and the request
 * falls through to a real 404.
 */
export function startMockApi(): Promise<void> {
  started ??= (async () => {
    const [{ setupWorker }, { handlers }] = await Promise.all([
      import('msw/browser'),
      import('./handlers'),
    ]);

    await setupWorker(...handlers).start({
      // The app is entirely mock-backed, so anything unhandled is a real bug
      // worth seeing rather than something to pass through silently.
      onUnhandledRequest: 'warn',
      serviceWorker: { url: '/mockServiceWorker.js' },
      quiet: true,
    });
  })();

  return started;
}
