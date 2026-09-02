import { beforeEach, describe, expect, it } from 'vitest';
import { makeStore } from './store';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  hydratePreferences,
  loadPreferences,
  savePreferences,
  setDensity,
  setPageSize,
} from './preferences';

// A storage that can be made to misbehave the way a real one does.
function fakeStorage(initial: Record<string, string> = {}, mode: 'ok' | 'throws' = 'ok'): Storage {
  const map = new Map(Object.entries(initial));

  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (key: string) => {
      if (mode === 'throws') throw new Error('storage blocked');
      return map.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (mode === 'throws') throw new Error('storage blocked');
      map.set(key, value);
    },
    removeItem: (key: string) => void map.delete(key),
  };
}

beforeEach(() => localStorage.clear());

describe('loadPreferences', () => {
  it('falls back to defaults when nothing is saved', () => {
    expect(loadPreferences(fakeStorage())).toEqual(DEFAULT_PREFERENCES);
  });

  it('reads what was saved', () => {
    const storage = fakeStorage({
      [PREFERENCES_STORAGE_KEY]: JSON.stringify({ density: 'compact', pageSize: 100 }),
    });

    expect(loadPreferences(storage)).toEqual({ density: 'compact', pageSize: 100 });
  });

  it('ignores a value written by an older or hand-edited build', () => {
    for (const raw of ['{}', 'null', '[]', '{"density":"cosy","pageSize":50}', '{"pageSize":7}']) {
      const storage = fakeStorage({ [PREFERENCES_STORAGE_KEY]: raw });
      expect(loadPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
    }
  });

  it('ignores malformed json rather than throwing', () => {
    const storage = fakeStorage({ [PREFERENCES_STORAGE_KEY]: 'not json at all' });

    expect(loadPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
  });

  it('survives storage that refuses to be read', () => {
    expect(loadPreferences(fakeStorage({}, 'throws'))).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('savePreferences', () => {
  it('round-trips through storage', () => {
    const storage = fakeStorage();
    savePreferences({ density: 'compact', pageSize: 25 }, storage);

    expect(loadPreferences(storage)).toEqual({ density: 'compact', pageSize: 25 });
  });

  it('survives storage that refuses to be written', () => {
    expect(() => savePreferences(DEFAULT_PREFERENCES, fakeStorage({}, 'throws'))).not.toThrow();
  });
});

describe('preferences slice', () => {
  it('starts from the defaults, never from storage', () => {
    // Preloading from storage would make the server and first client render
    // disagree, which is a hydration error.
    expect(makeStore().getState().preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('updates density and page size independently', () => {
    const store = makeStore();

    store.dispatch(setDensity('compact'));
    expect(store.getState().preferences).toEqual({ ...DEFAULT_PREFERENCES, density: 'compact' });

    store.dispatch(setPageSize(100));
    expect(store.getState().preferences).toEqual({ density: 'compact', pageSize: 100 });
  });

  it('replaces everything on hydrate', () => {
    const store = makeStore();
    store.dispatch(setDensity('compact'));
    store.dispatch(hydratePreferences({ density: 'comfortable', pageSize: 25 }));

    expect(store.getState().preferences).toEqual({ density: 'comfortable', pageSize: 25 });
  });

  it('leaves the api cache alone', () => {
    const store = makeStore();
    store.dispatch(setDensity('compact'));

    expect(store.getState().api.queries).toEqual({});
  });
});
