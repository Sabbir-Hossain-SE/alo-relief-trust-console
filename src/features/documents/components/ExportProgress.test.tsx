import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/render';
import type { ExportState } from '../useCsvExport';
import { ExportProgress } from './ExportProgress';

function render(state: ExportState) {
  renderWithTheme(<ExportProgress state={state} />);
}

describe('ExportProgress', () => {
  it('shows nothing before an export has been asked for', () => {
    const { container } = renderWithTheme(<ExportProgress state={{ status: 'idle' }} />);

    expect(container).toBeEmptyDOMElement();
  });

  // A bar that invents a percentage from an unknown total is worse than one
  // that admits it, which is the rule the folder walk already follows.
  it('is indeterminate until the response says how large the file is', () => {
    render({ status: 'running', received: 4096, total: null });

    const bar = screen.getByRole('progressbar', { name: 'Preparing the export' });
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByText(/4\.0 KB/)).toBeInTheDocument();
  });

  it('reports a real percentage once the size is known', () => {
    render({ status: 'running', received: 512, total: 1024 });

    expect(screen.getByRole('progressbar', { name: 'Preparing the export' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.getByText(/512 B of 1\.0 KB . 50%/)).toBeInTheDocument();
  });

  it('announces progress without repeating itself on every chunk', () => {
    render({ status: 'running', received: 512, total: 1024 });

    expect(screen.getByRole('status')).toHaveTextContent('Export 50% prepared.');
  });

  it('says how many documents were exported', () => {
    render({ status: 'done', rows: 12_430 });

    expect(screen.getByRole('status')).toHaveTextContent('12,430 documents exported.');
  });

  it('uses the singular for one document', () => {
    render({ status: 'done', rows: 1 });

    expect(screen.getByRole('status')).toHaveTextContent('1 document exported.');
  });

  // An empty file makes an operator open it to find out it was empty.
  it('says nothing was saved when nothing matched', () => {
    render({ status: 'done', rows: 0 });

    expect(screen.getByRole('status')).toHaveTextContent('no file was saved');
  });

  it('says a cancel saved nothing, rather than reporting a failure', () => {
    render({ status: 'cancelled' });

    expect(screen.getByRole('status')).toHaveTextContent('Export cancelled. Nothing was saved.');
  });

  it("reports a failure in the operator's own terms", () => {
    render({ status: 'failed', message: 'The export could not be completed.' });

    expect(screen.getByRole('status')).toHaveTextContent('The export could not be completed.');
  });
});
