'use client';

import { useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeStore } from './store';

// Creates the store once per client, not once per module, so it never leaks
// between requests during server rendering. Lazy state rather than a ref, since
// a ref may not be read during render.
export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);

  return <Provider store={store}>{children}</Provider>;
}
