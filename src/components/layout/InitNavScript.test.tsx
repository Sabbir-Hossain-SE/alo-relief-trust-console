import { afterEach, describe, expect, it } from 'vitest';
import { NAV_COLLAPSED_ATTRIBUTE, PREFERENCES_STORAGE_KEY } from '@/store/preferences';
import { navCollapsedScript } from './InitNavScript';

/** Runs the script the way the browser would: as plain text, before any module. */
const run = () => new Function(navCollapsedScript())();

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(NAV_COLLAPSED_ATTRIBUTE);
});

describe('navCollapsedScript', () => {
  it('marks the document when the stored preference says collapsed', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ density: 'compact', pageSize: 50, navCollapsed: true }),
    );

    run();

    expect(document.documentElement).toHaveAttribute(NAV_COLLAPSED_ATTRIBUTE);
  });

  it('leaves the document alone when the rail is expanded or nothing is stored', () => {
    run();
    expect(document.documentElement).not.toHaveAttribute(NAV_COLLAPSED_ATTRIBUTE);

    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ density: 'compact', pageSize: 50, navCollapsed: false }),
    );
    run();
    expect(document.documentElement).not.toHaveAttribute(NAV_COLLAPSED_ATTRIBUTE);
  });

  // Hand-edited storage must not take the page down before it has even loaded.
  it('survives storage that is not json', () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, 'not json');

    expect(run).not.toThrow();
    expect(document.documentElement).not.toHaveAttribute(NAV_COLLAPSED_ATTRIBUTE);
  });
});
