import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/render';
import { expectNoViolations } from '@/test/axe';
import { PROCESSING_STATUSES } from '@/domain/status';
import { StatusChip } from './StatusChip';
import { ConfidenceMeter } from './ConfidenceMeter';

describe('StatusChip', () => {
  it('names every status in text, not only in colour', () => {
    for (const status of PROCESSING_STATUSES) {
      const { unmount } = renderWithTheme(<StatusChip status={status} />);
      expect(screen.getByText(/\w/)).toBeInTheDocument();
      unmount();
    }
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithTheme(<StatusChip status="failed" />);
    await expectNoViolations(container);
  });
});

describe('ConfidenceMeter', () => {
  it('reads the band and the score aloud, so the bar is not load-bearing', () => {
    renderWithTheme(<ConfidenceMeter score={0.42} />);
    expect(screen.getByRole('img', { name: 'Low confidence, 42%' })).toBeInTheDocument();
  });

  it('keeps its text alternative when the visible label is hidden', () => {
    renderWithTheme(<ConfidenceMeter score={0.95} showLabel={false} />);
    expect(screen.getByRole('img', { name: 'High confidence, 95%' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithTheme(<ConfidenceMeter score={0.6} />);
    await expectNoViolations(container);
  });
});
