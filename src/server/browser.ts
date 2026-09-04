import { installUnloadHold } from '@/lib/unload/unloadHold';

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
    const [{ setupWorker }, { handlers }, { API_BASE }] = await Promise.all([
      import('msw/browser'),
      import('./handlers'),
      import('./api-contract'),
    ]);

    // Listens before the worker does. It reports this page closed on
    // `beforeunload`, and a hold on leaving — the operator may yet stay — has
    // to be heard ahead of that report, which the browser decides by order of
    // registration alone. See `lib/unload/unloadHold.ts`.
    installUnloadHold();

    await setupWorker(...handlers).start({
      /**
       * The worker sees every request the page makes, not only ours: Next.js
       * fetches RSC payloads on each client-side navigation and prefetch, plus
       * the favicon and its own assets. Warning about those buries the one
       * warning worth reading, so only an unhandled call to the mock API — which
       * really would be a missing handler — is reported.
       */
      onUnhandledRequest(request, print) {
        if (new URL(request.url).pathname.startsWith(API_BASE)) print.warning();
      },
      serviceWorker: { url: '/mockServiceWorker.js' },
      quiet: true,
    });
  })();

  return started;
}
