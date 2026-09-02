'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector, useAppStore } from './hooks';
import {
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
 */
export function usePreferencesSync(): void {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  useEffect(() => {
    dispatch(hydratePreferences(loadPreferences()));

    let previous = store.getState().preferences;

    return store.subscribe(() => {
      const current = store.getState().preferences;
      if (current === previous) return;

      previous = current;
      savePreferences(current);
    });
  }, [dispatch, store]);
}
