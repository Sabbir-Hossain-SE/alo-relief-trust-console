import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppDispatch } from './hooks';
import { NAV_COLLAPSED_ATTRIBUTE, PREFERENCES_STORAGE_KEY, setNavCollapsed } from './preferences';
import { StoreProvider } from './StoreProvider';

function Expand() {
  const dispatch = useAppDispatch();
  return (
    <button type="button" onClick={() => dispatch(setNavCollapsed(false))}>
      expand
    </button>
  );
}

const stored = (navCollapsed: boolean) =>
  JSON.stringify({ density: 'comfortable', pageSize: 50, navCollapsed });

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(NAV_COLLAPSED_ATTRIBUTE);
});

describe('usePreferencesSync', () => {
  /**
   * The rail is laid out from this mark, not from React state, so that the
   * script running before first paint and the store agree on one thing.
   */
  it('marks the document from the stored preference and keeps the mark in step', async () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, stored(true));

    render(
      <StoreProvider>
        <Expand />
      </StoreProvider>,
    );

    expect(document.documentElement).toHaveAttribute(NAV_COLLAPSED_ATTRIBUTE);

    await userEvent.click(screen.getByRole('button', { name: 'expand' }));

    expect(document.documentElement).not.toHaveAttribute(NAV_COLLAPSED_ATTRIBUTE);
    expect(JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}')).toMatchObject({
      navCollapsed: false,
    });
  });

  it('follows a change made in another tab', () => {
    render(
      <StoreProvider>
        <div />
      </StoreProvider>,
    );
    expect(document.documentElement).not.toHaveAttribute(NAV_COLLAPSED_ATTRIBUTE);

    localStorage.setItem(PREFERENCES_STORAGE_KEY, stored(true));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: PREFERENCES_STORAGE_KEY }));
    });

    expect(document.documentElement).toHaveAttribute(NAV_COLLAPSED_ATTRIBUTE);
  });
});
