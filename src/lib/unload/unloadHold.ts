/**
 * A hold on leaving the page, for work that would be lost with it.
 *
 * One listener, installed once, ahead of any other. Being first matters. The
 * mock backend's worker library reports the page closed on the same event,
 * and when the operator was asked whether to leave and said no, its service
 * worker had already dropped the page — and, being the page's only one,
 * unregistered itself — so every request from a page that was still open fell
 * through to the real server as a 404. The browser runs `beforeunload`
 * listeners in the order they were added, capture phase or not, so the only
 * way to speak before that report is to be registered before it.
 */

/** Older engines show the dialog only for a non-empty value; none display the text. */
const MESSAGE = 'Work on this page is still running.';

let holds = 0;
let installed = false;

function refuse(event: BeforeUnloadEvent): void {
  if (holds === 0) return;

  event.preventDefault();
  event.returnValue = MESSAGE;
  // Nothing else may hear it. The page may be staying, and a listener that
  // acts on the page going would act wrongly. A page that leaves after all
  // leaves a stale client id behind in the worker, which costs nothing.
  event.stopImmediatePropagation();
}

/**
 * Registers the listener. Called at boot, before anything else listens for the
 * event; a later call does nothing.
 */
export function installUnloadHold(): void {
  if (installed || typeof window === 'undefined') return;

  installed = true;
  window.addEventListener('beforeunload', refuse);
}

/**
 * Takes a hold, and returns its release.
 *
 * The page asks before leaving while any hold stands. A release counts once,
 * however many times it is called, so a caller cannot free someone else's.
 */
export function holdUnload(): () => void {
  installUnloadHold();
  holds += 1;

  let released = false;
  return () => {
    if (released) return;

    released = true;
    holds -= 1;
  };
}
