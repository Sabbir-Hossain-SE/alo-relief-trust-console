import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressAnnouncer, decile, everyNth } from './ProgressAnnouncer';

describe('decile', () => {
  it('changes once per tenth of the work', () => {
    expect(decile(0.11)).toBe(decile(0.19));
    expect(decile(0.21)).not.toBe(decile(0.19));
  });
});

describe('everyNth', () => {
  it('changes once per interval when there is no known total', () => {
    expect(everyNth(1999, 2000)).toBe(everyNth(1000, 2000));
    expect(everyNth(2001, 2000)).not.toBe(everyNth(1999, 2000));
  });
});

describe('ProgressAnnouncer', () => {
  it('exposes a polite live region rather than an alert', () => {
    render(<ProgressAnnouncer step={0} message="Starting." />);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Starting.');
  });

  it('holds the message while the step is unchanged', () => {
    const { rerender } = render(<ProgressAnnouncer step={1} message="11 of 100." />);

    rerender(<ProgressAnnouncer step={1} message="12 of 100." />);
    rerender(<ProgressAnnouncer step={1} message="19 of 100." />);

    // A reader interrupted on every file never finishes a sentence.
    expect(screen.getByRole('status')).toHaveTextContent('11 of 100.');
  });

  it('updates when the step moves on', () => {
    const { rerender } = render(<ProgressAnnouncer step={1} message="11 of 100." />);

    rerender(<ProgressAnnouncer step={2} message="21 of 100." />);

    expect(screen.getByRole('status')).toHaveTextContent('21 of 100.');
  });

  it('always announces the finish, even inside a step it already announced', () => {
    const { rerender } = render(<ProgressAnnouncer step={9} message="98 of 100." />);

    rerender(<ProgressAnnouncer step={9} message="Finished." final />);

    expect(screen.getByRole('status')).toHaveTextContent('Finished.');
  });

  it('announces the first message it is given', () => {
    // The initial step is NaN, which never equals a real one, so mounting mid-run
    // still says something rather than staying silent until the next tenth.
    render(<ProgressAnnouncer step={4} message="Halfway." />);
    expect(screen.getByRole('status')).toHaveTextContent('Halfway.');
  });
});
