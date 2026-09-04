import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectNoViolations } from '@/test/axe';
import { renderWithTheme } from '@/test/render';
import { NavList } from './NavList';
import { NAV_ITEMS } from './navigation';

const pathname = vi.hoisted(() => ({ value: '/documents' }));

vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

describe('NavList', () => {
  it('links to every destination', () => {
    renderWithTheme(<NavList />);

    for (const item of NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.label })).toHaveAttribute('href', item.href);
    }
  });

  it('marks the current page for assistive technology, not only in colour', () => {
    renderWithTheme(<NavList />);

    expect(screen.getByRole('link', { name: 'Documents' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Upload' })).not.toHaveAttribute('aria-current');
  });

  /**
   * A collapsed label is hidden visually rather than removed. Dropping the text
   * would leave five links whose only accessible name is an icon.
   */
  it('keeps every link named when collapsed', () => {
    renderWithTheme(<NavList collapsed />);

    for (const item of NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.label })).toBeInTheDocument();
    }
  });

  it('names a collapsed link on hover, for everyone who is not using a reader', async () => {
    renderWithTheme(<NavList collapsed />);

    await userEvent.hover(screen.getByRole('link', { name: 'Review queue' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Review queue');
  });

  it('does not repeat the label in a tooltip when it is already on screen', async () => {
    renderWithTheme(<NavList />);

    await userEvent.hover(screen.getByRole('link', { name: 'Review queue' }));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  // The drawer has to close behind a tap, or the destination opens underneath it.
  it('reports a navigation so the small-screen drawer can close', async () => {
    // jsdom cannot follow a link and logs when it is asked to. The click is the
    // subject here, not the navigation.
    const swallow = (event: MouseEvent) => event.preventDefault();
    document.addEventListener('click', swallow);

    const onNavigate = vi.fn();
    renderWithTheme(<NavList onNavigate={onNavigate} />);

    await userEvent.click(screen.getByRole('link', { name: 'Batches' }));
    document.removeEventListener('click', swallow);

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations, collapsed or not', async () => {
    const expanded = renderWithTheme(<NavList />);
    await expectNoViolations(expanded.container);

    const collapsed = renderWithTheme(<NavList collapsed />);
    await expectNoViolations(collapsed.container);
  });
});
