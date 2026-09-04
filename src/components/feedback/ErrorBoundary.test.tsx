import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '@/test/render';
import { ErrorBoundary } from './ErrorBoundary';

function Boom({ throws }: { throws: boolean }): React.ReactElement {
  if (throws) throw new Error('pageSize cannot exceed 100');
  return <p>The grid</p>;
}

// React logs every caught error itself. The boundary is the thing under test.
beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    renderWithTheme(
      <ErrorBoundary>
        <Boom throws={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('The grid')).toBeInTheDocument();
  });

  it('replaces a region that throws instead of losing the page with it', () => {
    renderWithTheme(
      <>
        <button type="button">Clear filters</button>
        <ErrorBoundary title="The documents could not be listed">
          <Boom throws />
        </ErrorBoundary>
      </>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('The documents could not be listed');
    // The point of a boundary here: what sits outside it survives, so the
    // operator still has the control that undoes whatever caused the failure.
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('says what happened and what is safe, not "something went wrong"', () => {
    renderWithTheme(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Nothing in the archive has been changed/);
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  it('carries the exception as folded diagnostic rather than as the explanation', () => {
    renderWithTheme(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    );

    const detail = screen.getByText('Technical detail').closest('details');
    expect(detail).not.toBeNull();
    expect(detail?.open).toBe(false);
    expect(detail).toHaveTextContent('pageSize cannot exceed 100');
  });

  it('recovers when the operator tries again', async () => {
    const user = userEvent.setup();

    function Host() {
      const [broken, setBroken] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setBroken(false)}>
            Fix it
          </button>
          <ErrorBoundary>
            <Boom throws={broken} />
          </ErrorBoundary>
        </>
      );
    }

    renderWithTheme(<Host />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fix it' }));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('The grid')).toBeInTheDocument();
  });

  it('clears itself when the thing that broke it changes', async () => {
    const user = userEvent.setup();

    function Host() {
      const [query, setQuery] = useState('pageSize=200');
      return (
        <>
          <button type="button" onClick={() => setQuery('pageSize=50')}>
            Change the filter
          </button>
          <ErrorBoundary resetKey={query}>
            <Boom throws={query === 'pageSize=200'} />
          </ErrorBoundary>
        </>
      );
    }

    renderWithTheme(<Host />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // No "Try again" needed: a filter that fixes the cause should not leave the
    // operator looking at the failure it fixed.
    await user.click(screen.getByRole('button', { name: 'Change the filter' }));
    expect(screen.getByText('The grid')).toBeInTheDocument();
  });

  it('reports the error, so a crash is not only visible to the person hitting it', () => {
    const onError = vi.fn();

    renderWithTheme(
      <ErrorBoundary onError={onError}>
        <Boom throws />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'pageSize cannot exceed 100' }),
      expect.anything(),
    );
  });
});
