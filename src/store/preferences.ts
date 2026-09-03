import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { z } from 'zod';

/**
 * Operator preferences, and only those.
 *
 * Deliberately not the API cache. That is server state: persisting it would
 * restore a view of data the mock backend no longer has after a reload, which
 * looks like it works and is worse than an empty state. Filters, search, sort
 * and page live in the URL instead, which is shareable and refresh-safe.
 */
const preferencesSchema = z.object({
  density: z.enum(['comfortable', 'compact']),
  pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]),
  /**
   * Whether the navigation is reduced to an icon rail.
   *
   * Defaulted rather than required, so a preferences object written by a build
   * that predates the rail still parses. Without the default the whole object
   * would fail validation and an operator would silently lose their density and
   * page size to gain a nav setting they never asked for.
   */
  navCollapsed: z.boolean().default(false),
});

export type Preferences = z.infer<typeof preferencesSchema>;
export type GridDensity = Preferences['density'];

export const DEFAULT_PREFERENCES: Preferences = {
  density: 'comfortable',
  pageSize: 50,
  navCollapsed: false,
};

export const PREFERENCES_STORAGE_KEY = 'alo.preferences.v1';

/**
 * Reads saved preferences, falling back to defaults on anything unexpected.
 *
 * Parsed rather than cast: this is user-editable storage that may also hold a
 * shape written by an older build, and a preference is never worth an error
 * screen.
 */
export function loadPreferences(storage?: Storage): Preferences {
  const store = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
  if (store === undefined) return DEFAULT_PREFERENCES;

  try {
    const raw = store.getItem(PREFERENCES_STORAGE_KEY);
    if (raw === null) return DEFAULT_PREFERENCES;

    const parsed = preferencesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
  } catch {
    // Private browsing and blocked storage both throw on access.
    return DEFAULT_PREFERENCES;
  }
}

// Writes preferences, ignoring storage that refuses to be written to.
export function savePreferences(value: Preferences, storage?: Storage): void {
  const store = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
  if (store === undefined) return;

  try {
    store.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // A preference that cannot be saved is not worth interrupting anyone over.
  }
}

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState: DEFAULT_PREFERENCES,
  reducers: {
    setDensity(state, action: PayloadAction<GridDensity>) {
      state.density = action.payload;
    },
    setPageSize(state, action: PayloadAction<Preferences['pageSize']>) {
      state.pageSize = action.payload;
    },
    setNavCollapsed(state, action: PayloadAction<boolean>) {
      state.navCollapsed = action.payload;
    },
    // Applied after mount rather than as preloaded state, so the server and the
    // first client render agree and hydration stays clean.
    hydratePreferences(_state, action: PayloadAction<Preferences>) {
      return action.payload;
    },
  },
});

export const { setDensity, setPageSize, setNavCollapsed, hydratePreferences } =
  preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;
