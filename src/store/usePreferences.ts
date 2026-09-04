'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector, useAppStore } from './hooks';
import {
  NAV_COLLAPSED_ATTRIBUTE,
  PREFERENCES_STORAGE_KEY,
  hydratePreferences,
  loadPreferences,
  savePreferences,
  type Preferences,
} from './preferences';

/** Reads operator preferences. */
export function usePreferences(): Preferences {
  return useAppSelector((state) => state.preferences);
}

/**
 * Keeps preferences and local storage in step.
 *
 * Storage is read after mount rather than into preloaded state, because the
 * server render has no access to it and a mismatch on the first client render
 * is a hydration error. Mounted once, at the provider.
 *
 * It also listens for the other tabs. A console is often open twice — the grid
 * in one, a batch in the other — and without this a density chosen in one tab
 * was overwritten by the next change made in the other, because each tab wrote
 * back the whole object it last knew.
 */
export function usePreferencesSync(): void {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  useEffect(() => {
    let previous = store.getState().preferences;

    // The mark the rail is laid out from. Written here, beside storage, rather
    // than from a component effect: an effect keyed on state would run once
    // with the defaults before storage had been read and clear the mark the
    // inline script set, which is the flash this exists to remove.
    const reflect = (value: Preferences) => {
      document.documentElement.toggleAttribute(NAV_COLLAPSED_ATTRIBUTE, value.navCollapsed);
    };

    // Reads storage into the store without writing it straight back out.
    const adopt = () => {
      dispatch(hydratePreferences(loadPreferences()));
      previous = store.getState().preferences;
      reflect(previous);
    };

    adopt();

    const unsubscribe = store.subscribe(() => {
      const current = store.getState().preferences;
      if (current === previous) return;

      previous = current;
      savePreferences(current);
      reflect(current);
    });

    // A null key is the whole storage being cleared, which also changes ours.
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PREFERENCES_STORAGE_KEY || event.key === null) adopt();
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, [dispatch, store]);
}
