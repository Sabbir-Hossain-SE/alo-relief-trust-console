import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/render';
import { expectNoViolations } from '@/test/axe';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

describe('EmptyState', () => {
  it('gives the screen a heading', () => {
    // Rendered as a paragraph, these titles were invisible to anything
    // navigating by heading — which is most of how a screen is skimmed.
    renderWithTheme(<EmptyState title="No batches yet" description="Upload a folder." />);
    expect(screen.getByRole('heading', { name: 'No batches yet' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithTheme(<EmptyState title="Nothing here" />);
    await expectNoViolations(container);
  });
});

describe('ErrorState', () => {
  it('gives the screen a heading and keeps its alert role', () => {
    renderWithTheme(<ErrorState title="That failed" description="Try again." onRetry={() => {}} />);

    expect(screen.getByRole('heading', { name: 'That failed' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('That failed');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithTheme(
      <ErrorState title="That failed" description="Try again." onRetry={() => {}} />,
    );
    await expectNoViolations(container);
  });
});
