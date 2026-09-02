import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';

// Builds a fresh store. A factory rather than a singleton so tests get isolation.
export function makeStore() {
  return configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (getDefault) => getDefault().concat(api.middleware),

    // Left on outside tests, including the deployed demo. This is a prototype
    // whose point is to show how the data layer behaves, and the cache, the
    // tag invalidations and the polling lifecycle are all far easier to follow
    // in the DevTools timeline than in a description of them.
    devTools:
      process.env.NODE_ENV === 'test'
        ? false
        : {
            name: 'Alo Relief Trust — Document Console',
            // Action names carry the endpoint, so the timeline reads as a list
            // of API calls rather than of internal RTK Query bookkeeping.
            actionsDenylist: ['api/subscriptions'],
          },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
