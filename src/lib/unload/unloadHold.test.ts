import { describe, expect, it, vi } from 'vitest';
import { holdUnload, installUnloadHold } from './unloadHold';

/** Fires the event the browser would, with a listener behind ours to see whether it is reached. */
function leave(): { event: Event; laterHeard: boolean } {
  const later = vi.fn();
  window.addEventListener('beforeunload', later);

  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);

  window.removeEventListener('beforeunload', later);
  return { event, laterHeard: later.mock.calls.length > 0 };
}

describe('holdUnload', () => {
  it('lets the page go, and everyone hear of it, while nothing holds it', () => {
    installUnloadHold();

    const { event, laterHeard } = leave();

    expect(event.defaultPrevented).toBe(false);
    expect(laterHeard).toBe(true);
  });

  /**
   * The worker library behind the mock backend listens for the same event and
   * tells its service worker the page has closed. When the operator then stays,
   * that report has already cost them the backend.
   */
  it('asks before leaving while a hold stands, and lets nothing else hear it', () => {
    const release = holdUnload();

    const { event, laterHeard } = leave();

    expect(event.defaultPrevented).toBe(true);
    expect(laterHeard).toBe(false);

    release();
  });

  it('lets the page go again once every hold is released', () => {
    const first = holdUnload();
    const second = holdUnload();

    first();
    expect(leave().event.defaultPrevented).toBe(true);

    second();
    expect(leave().event.defaultPrevented).toBe(false);
  });

  it('counts a release once, however often it is called', () => {
    const release = holdUnload();
    const other = holdUnload();

    release();
    release();
    expect(leave().event.defaultPrevented).toBe(true);

    other();
    expect(leave().event.defaultPrevented).toBe(false);
  });
});
