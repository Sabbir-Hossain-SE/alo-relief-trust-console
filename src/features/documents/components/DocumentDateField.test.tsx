import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '@/test/render';
import type { NormalizedRecord } from '@/domain/document';
import { CorrectionForm } from './CorrectionForm';

function fields(overrides: Partial<NormalizedRecord> = {}): NormalizedRecord {
  const certain = (value: string) => ({ value, confidence: 0.95, source: 'ocr' as const });

  return {
    personName: certain('Nasrin Ali'),
    phone: { value: '+8801711111111', confidence: 0.4, source: 'ocr' },
    location: certain('Sylhet Sadar'),
    programName: certain('Winter relief'),
    documentDate: certain('2024-03-18'),
    ...overrides,
  };
}

function setup(overrides: Partial<NormalizedRecord> = {}) {
  const onSave = vi.fn();
  renderWithTheme(
    <CorrectionForm fields={fields(overrides)} underReview isSaving={false} onSave={onSave} />,
  );
  return { onSave, user: userEvent.setup() };
}

/** Exercised through the form, which is the only place this field is used. */
describe('DocumentDateField', () => {
  it('shows the document date as a date rather than as text', () => {
    setup();

    const date = screen.getByRole('group', { name: 'Document date' });
    expect(within(date).getByRole('spinbutton', { name: 'Year' })).toHaveTextContent('2024');
    expect(within(date).getByRole('spinbutton', { name: 'Month' })).toHaveTextContent('03');
    expect(within(date).getByRole('spinbutton', { name: 'Day' })).toHaveTextContent('18');
  });

  it('will not save a date the document could not carry', async () => {
    const { onSave, user } = setup();

    const year = within(screen.getByRole('group', { name: 'Document date' })).getByRole(
      'spinbutton',
      { name: 'Year' },
    );
    await user.click(year);
    await user.keyboard('2099');
    await user.tab();

    await waitFor(() =>
      expect(screen.getByText('A document cannot be dated in the future')).toBeVisible(),
    );

    await user.click(screen.getByRole('button', { name: 'Save corrections' }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
