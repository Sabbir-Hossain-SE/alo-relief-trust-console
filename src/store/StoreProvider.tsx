'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { setupListeners } from '@reduxjs/toolkit/query';
import { makeStore } from './store';
import { usePreferencesSync } from './usePreferences';

function PreferencesSync() {
  usePreferencesSync();
  return null;
}

// Creates the store once per client, not once per module, so it never leaks
// between requests during server rendering. Lazy state rather than a ref, since
// a ref may not be read during render.
export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);

  // Tracks focus for the polls in `polling.ts`, which stop while the tab is hidden.
  useEffect(() => setupListeners(store.dispatch), [store]);

  return (
    <Provider store={store}>
      <PreferencesSync />
      {children}
    </Provider>
  );
}
