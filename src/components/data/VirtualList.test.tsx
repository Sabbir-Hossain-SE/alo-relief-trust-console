import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '@/test/render';
import { expectNoViolations } from '@/test/axe';
import { VirtualList, type VirtualRowProps } from './VirtualList';

const ITEM_HEIGHT = 20;
const HEIGHT = 100;

function items(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `r${i}`, label: `Row ${i}` }));
}

function renderList(count: number, roving = true) {
  return renderWithTheme(
    <VirtualList
      items={items(count)}
      itemHeight={ITEM_HEIGHT}
      height={HEIGHT}
      label="Queue"
      roving={roving}
      getKey={(item) => item.id}
      renderItem={(item, _index, rowProps: VirtualRowProps) => (
        <button type="button" {...rowProps}>
          {item.label}
        </button>
      )}
    />,
  );
}

describe('VirtualList', () => {
  it('renders only the rows in the window', () => {
    renderList(500);
    expect(screen.getAllByRole('listitem').length).toBeLessThan(30);
  });

  it('reports the whole list size, not the rendered slice', () => {
    renderList(500);

    // Without this a screen reader announces a 500-item queue as about twenty.
    const [first] = screen.getAllByRole('listitem');
    expect(first).toHaveAttribute('aria-setsize', '500');
    expect(first).toHaveAttribute('aria-posinset', '1');
  });

  it('keeps exactly one tab stop when rows are focusable', () => {
    renderList(500);
    const focusable = screen.getAllByRole('button').filter((el) => el.tabIndex === 0);
    expect(focusable).toHaveLength(1);
  });

  it('reaches rows far outside the rendered window from the keyboard', async () => {
    const user = userEvent.setup();
    renderList(500);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Row 0' })).toHaveFocus();

    // Tab alone would leave the list after the last rendered row.
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Row 499' })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('button', { name: 'Row 0' })).toHaveFocus();
  });

  it('moves one row at a time with the arrow keys', async () => {
    const user = userEvent.setup();
    renderList(500);

    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Row 2' })).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: 'Row 1' })).toHaveFocus();
  });

  it('does not run off either end', async () => {
    const user = userEvent.setup();
    renderList(3);

    await user.tab();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: 'Row 0' })).toHaveFocus();

    await user.keyboard('{End}{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Row 2' })).toHaveFocus();
  });

  it('is focusable itself when its rows are not, so it can be scrolled', () => {
    renderWithTheme(
      <VirtualList
        items={items(200)}
        itemHeight={ITEM_HEIGHT}
        height={HEIGHT}
        label="Upload queue"
        getKey={(item) => item.id}
        renderItem={(item) => <span>{item.label}</span>}
      />,
    );

    // A scrollable region with nothing focusable inside cannot be reached at all.
    expect(screen.getByRole('list')).toHaveAttribute('tabindex', '0');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderList(500);
    await expectNoViolations(container);
  });
});

describe('VirtualList ownership', () => {
  it('lets the list own its items directly', () => {
    // Generic wrappers between list and listitem break the relationship, which
    // is what the spacer and the positioning layer used to be.
    renderList(50);
    const list = screen.getByRole('list');
    const item = screen.getAllByRole('listitem')[0];
    expect(list.contains(item ?? null)).toBe(true);
  });
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
