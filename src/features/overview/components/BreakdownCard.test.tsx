import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { expectNoViolations } from '@/test/axe';
import { renderWithTheme } from '@/test/render';
import { BreakdownCard, type BreakdownRow } from './BreakdownCard';

const ROWS: BreakdownRow[] = [
  { key: 'a', label: 'Unreadable scan', count: 3200, href: '/documents?cause=unreadable_scan' },
  { key: 'b', label: 'OCR timed out', count: 800, href: '/documents?cause=ocr_timeout' },
];

function render(rows: BreakdownRow[] = ROWS, total = 4000) {
  return renderWithTheme(
    <BreakdownCard
      title="Why documents fail"
      caption="4,000 failures"
      rows={rows}
      total={total}
      emptyMessage="No document in the archive has failed."
    />,
  );
}

describe('BreakdownCard', () => {
  it('names each row, its count and its share', () => {
    render();

    expect(screen.getByRole('heading', { name: 'Why documents fail' })).toBeInTheDocument();
    expect(screen.getByText('3,200')).toBeInTheDocument();
    expect(screen.getByText(/80%/)).toBeInTheDocument();
  });

  // A figure an operator cannot open tells them where the work is and then
  // makes them go and find it by hand.
  it('makes every figure a way into the documents behind it', () => {
    render();

    expect(
      screen.getByRole('link', { name: '3,200 unreadable scan — open in documents' }),
    ).toHaveAttribute('href', '/documents?cause=unreadable_scan');
  });

  it('says what an empty breakdown means rather than rendering nothing', () => {
    render([], 0);

    expect(screen.getByText('No document in the archive has failed.')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('reports a share of nothing as 0% rather than NaN', () => {
    render([{ key: 'a', label: 'Unreadable scan', count: 0, href: '/documents' }], 0);

    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render();

    await expectNoViolations(container);
  });
});
