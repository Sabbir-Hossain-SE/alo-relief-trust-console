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

function setup(overrides: Partial<NormalizedRecord> = {}) {
  const onSave = vi.fn();
  renderWithTheme(
    <CorrectionForm fields={fields(overrides)} underReview isSaving={false} onSave={onSave} />,
  );
  return { onSave, user: userEvent.setup() };
}

/** Exercised through the form, which is the only place this field is used. */
describe('PhoneField', () => {
  it('rejects a number of the right length that no operator prefix matches', async () => {
    // The old rule counted characters, so this passed. It is exactly the kind
    // of misread the review queue exists to catch.
    const { onSave, user } = setup();
    const phone = screen.getByLabelText('Phone');

    await user.clear(phone);
    await user.type(phone, '1012345678');
    await user.tab();

    await waitFor(() => expect(phone).toHaveAttribute('aria-invalid', 'true'));
    await user.click(screen.getByRole('button', { name: 'Save corrections' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  /**
   * Every number on a form filed in Bangladesh is written 01712-345678, and an
   * operator copies it as written. The stored value has to lose the 0.
   */
  it('stores a number typed as it is written locally, trunk prefix and all', async () => {
    const { onSave, user } = setup();
    const phone = screen.getByLabelText('Phone');

    await user.clear(phone);
    await user.type(phone, '01712345678');
    await user.click(screen.getByRole('button', { name: 'Save corrections' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([{ field: 'phone', value: '+8801712345678' }]),
    );
  });

  // Pasted from a spreadsheet with its calling code in front, into the digits
  // box, with Bangladesh still selected. Read as national digits that became
  // +880442079460958 — the code doubled and the country wrong.
  it('follows a number pasted with its own calling code to its country', async () => {
    const { onSave, user } = setup();
    const phone = screen.getByLabelText('Phone');

    await user.clear(phone);
    await user.click(phone);
    await user.paste('+44 20 7946 0958');

    expect(screen.getByLabelText('Phone country')).toHaveTextContent('GB +44');
    expect(phone).toHaveValue('2079460958');

    await user.click(screen.getByRole('button', { name: 'Save corrections' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([{ field: 'phone', value: '+442079460958' }]),
    );
  });

  it('keeps the number when the country changes, and restates it in E.164', async () => {
    const { onSave, user } = setup();

    await user.click(screen.getByLabelText('Phone country'));
    await user.click(screen.getByRole('option', { name: 'United Kingdom +44' }));

    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '2071838750');
    await user.click(screen.getByRole('button', { name: 'Save corrections' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([{ field: 'phone', value: '+442071838750' }]),
    );
  });
});
