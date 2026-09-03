import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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

function setup(overrides: Partial<NormalizedRecord> = {}, underReview = true) {
  const onSave = vi.fn();
  renderWithTheme(
    <CorrectionForm
      fields={fields(overrides)}
      underReview={underReview}
      isSaving={false}
      onSave={onSave}
    />,
  );
  return { onSave, user: userEvent.setup() };
}

describe('CorrectionForm', () => {
  it('opens with the extracted values already in the inputs', () => {
    setup();
    expect(screen.getByLabelText('Person name')).toHaveValue('Nasrin Ali');
    expect(screen.getByLabelText('Phone')).toHaveValue('+8801711111111');
  });

  it('cannot be saved until something changes', async () => {
    const { user } = setup();
    expect(screen.getByRole('button', { name: 'Save corrections' })).toBeDisabled();

    await user.type(screen.getByLabelText('Person name'), 'x');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save corrections' })).toBeEnabled(),
    );
  });

  it('sends only the field that changed', async () => {
    const { onSave, user } = setup();

    await user.clear(screen.getByLabelText('Location'));
    await user.type(screen.getByLabelText('Location'), 'Dhaka');
    await user.click(screen.getByRole('button', { name: 'Save corrections' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([{ field: 'location', value: 'Dhaka' }]),
    );
  });

  it('ties a validation error to the input it belongs to', async () => {
    const { onSave, user } = setup();
    const phone = screen.getByLabelText('Phone');

    await user.clear(phone);
    await user.type(phone, 'call the office');
    await user.tab();

    // Announced with the field, not floating beside it: MUI wires helperText
    // through aria-describedby and `error` through aria-invalid.
    await waitFor(() => expect(phone).toHaveAttribute('aria-invalid', 'true'));
    expect(phone).toHaveAccessibleDescription(/digits, spaces/i);

    await user.click(screen.getByRole('button', { name: 'Save corrections' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('accepts an empty value, because a page may genuinely not carry one', async () => {
    const { onSave, user } = setup();

    await user.clear(screen.getByLabelText('Phone'));
    await user.click(screen.getByRole('button', { name: 'Save corrections' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([{ field: 'phone', value: '' }]));
  });

  it('lets an operator confirm values the pipeline was merely unsure about', async () => {
    const { onSave, user } = setup();

    await user.click(screen.getByRole('button', { name: 'These values are correct' }));

    // Recorded as a correction at the value already there, so the audit trail
    // shows a person checked it rather than the flag quietly disappearing.
    expect(onSave).toHaveBeenCalledWith([{ field: 'phone', value: '+8801711111111' }]);
  });

  it('does not claim empty inputs are correct values', async () => {
    // Extraction found nothing here. "These values are correct" would be a claim
    // that the page carries no name and no phone, which is a different thing.
    const { onSave, user } = setup({
      personName: { value: undefined, confidence: 0.1, source: 'ocr' },
      phone: { value: undefined, confidence: 0.1, source: 'ocr' },
    });

    expect(screen.queryByRole('button', { name: 'These values are correct' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Nothing more on the page' }));

    expect(onSave).toHaveBeenCalledWith([
      { field: 'personName', value: '' },
      { field: 'phone', value: '' },
    ]);
  });

  it('offers no confirmation when nothing is flagged', () => {
    setup({}, false);
    expect(screen.queryByRole('button', { name: 'These values are correct' })).toBeNull();
  });

  it('is fully reachable from the keyboard', async () => {
    const { user } = setup();

    await user.tab();
    expect(screen.getByLabelText('Person name')).toHaveFocus();

    for (const label of ['Phone', 'Location', 'Program', 'Document date']) {
      await user.tab();
      expect(screen.getByLabelText(label)).toHaveFocus();
    }
  });
});
