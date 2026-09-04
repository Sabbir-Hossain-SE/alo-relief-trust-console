'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector, useAppStore } from './hooks';
import {
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

    // Reads storage into the store without writing it straight back out.
    const adopt = () => {
      const loaded = loadPreferences();
      dispatch(hydratePreferences(loaded));
      previous = store.getState().preferences;
    };

    adopt();

    const unsubscribe = store.subscribe(() => {
      const current = store.getState().preferences;
      if (current === previous) return;

      previous = current;
      savePreferences(current);
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
