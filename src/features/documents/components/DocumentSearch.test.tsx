import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '@/test/render';
import { DocumentSearch } from './DocumentSearch';

const box = () => screen.getByRole('textbox', { name: 'Search documents' });

function setup(value = '') {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const view = renderWithTheme(<DocumentSearch value={value} onChange={onChange} />);

  return { user, onChange, view };
}

describe('DocumentSearch', () => {
  it('commits a term once typing pauses, not on every keystroke', async () => {
    const { user, onChange } = setup();

    await user.type(box(), 'rah');
    expect(onChange).not.toHaveBeenCalled();

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('rah'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  /**
   * A parent that re-renders inside the wait — the documents view does, once
   * per chunk while an export streams — used to hand the field a fresh
   * callback each time, and the timer keyed on it never ran.
   */
  it('still commits when the parent keeps re-rendering while the operator types', async () => {
    const { user, onChange, view } = setup();

    await user.type(box(), 'rah');

    // Faster than the debounce, with a new callback identity every time.
    const relay = vi.fn((term: string) => onChange(term));
    for (let i = 0; i < 6; i += 1) {
      view.rerender(<DocumentSearch value="" onChange={(term) => relay(term)} />);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    await waitFor(() => expect(relay).toHaveBeenCalledWith('rah'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  /**
   * The URL arrives a router transition after the commit that asked for it. A
   * keystroke typed in that gap used to be thrown away: the older value landed,
   * was mistaken for a change made elsewhere, and overwrote the field.
   */
  it('keeps what was typed while the last commit is still on its way to the url', async () => {
    const { user, onChange, view } = setup();

    await user.type(box(), 'ra');
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('ra'));

    await user.type(box(), 'h');
    view.rerender(<DocumentSearch value="ra" onChange={onChange} />);
    expect(box()).toHaveValue('rah');

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('rah'));
  });

  it('follows a change made elsewhere, such as the filters being cleared', () => {
    const { onChange, view } = setup('rahim');

    view.rerender(<DocumentSearch value="" onChange={onChange} />);

    expect(box()).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears on escape and commits the clearing', async () => {
    const { user, onChange } = setup('rahim');

    await user.click(box());
    await user.keyboard('{Escape}');
    expect(box()).toHaveValue('');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(''));
  });
});
