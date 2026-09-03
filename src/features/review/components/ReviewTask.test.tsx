import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '@/test/render';
import { expectNoViolations } from '@/test/axe';
import type { DocumentSummary } from '@/domain/document';
import { VirtualList } from '@/components/data/VirtualList';
import { ReviewTask, TASK_HEIGHT } from './ReviewTask';

function row(index: number): DocumentSummary {
  return {
    id: `ARC-${String(index).padStart(6, '0')}`,
    index,
    fileName: `consent_form-${index}.png`,
    documentType: 'consent_form',
    status: 'needs_review',
    confidence: 0.2,
    uploadedAt: Date.UTC(2025, 0, 14),
    personName: `Person ${index}`,
    location: 'Sylhet Sadar',
    attempts: 1,
  };
}

function renderQueue(count: number, onOpen = vi.fn()) {
  const result = renderWithTheme(
    <VirtualList
      items={Array.from({ length: count }, (_, i) => row(i))}
      itemHeight={TASK_HEIGHT}
      height={300}
      label="Review queue"
      roving
      getKey={(item) => item.id}
      renderItem={(item, _index, rowProps) => (
        <ReviewTask row={item} rowProps={rowProps} onOpen={() => onOpen(item.id)} isOpen={false} />
      )}
    />,
  );

  return { ...result, onOpen };
}

describe('ReviewTask in the queue', () => {
  it('opens a record with the keyboard alone', async () => {
    const user = userEvent.setup();
    const { onOpen } = renderQueue(100);

    await user.tab();
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onOpen).toHaveBeenCalledWith('ARC-000001');
  });

  it('names each row for a screen reader', () => {
    renderQueue(10);
    expect(screen.getByRole('button', { name: 'Review consent_form-0.png' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderQueue(100);
    await expectNoViolations(container);
  });
});
