import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressAnnouncer } from './ProgressAnnouncer';

describe('ProgressAnnouncer', () => {
  it('exposes a polite live region rather than an alert', () => {
    render(<ProgressAnnouncer completion={0} message="Starting." />);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Starting.');
  });

  it('holds the message while progress stays within the same tenth', () => {
    const { rerender } = render(<ProgressAnnouncer completion={0.11} message="11 of 100." />);

    rerender(<ProgressAnnouncer completion={0.12} message="12 of 100." />);
    rerender(<ProgressAnnouncer completion={0.19} message="19 of 100." />);

    // A reader interrupted on every file never finishes a sentence.
    expect(screen.getByRole('status')).toHaveTextContent('11 of 100.');
  });

  it('updates once progress crosses into the next tenth', () => {
    const { rerender } = render(<ProgressAnnouncer completion={0.11} message="11 of 100." />);

    rerender(<ProgressAnnouncer completion={0.21} message="21 of 100." />);

    expect(screen.getByRole('status')).toHaveTextContent('21 of 100.');
  });

  it('always announces the finish, even inside a tenth it already announced', () => {
    const { rerender } = render(<ProgressAnnouncer completion={0.98} message="98 of 100." />);

    rerender(<ProgressAnnouncer completion={1} message="Finished." settled />);

    expect(screen.getByRole('status')).toHaveTextContent('Finished.');
  });
});
