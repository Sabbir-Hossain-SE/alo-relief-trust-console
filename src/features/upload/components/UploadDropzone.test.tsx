import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/render';
import { UploadDropzone } from './UploadDropzone';

const zone = () =>
  screen.getByText('Drop documents or a folder here').closest('[data-drop-target]') as HTMLElement;

// The parts of a drop the zone reads. Entries are null, as they are wherever the entry API is absent.
function transfer(files: File[], items?: unknown[]): DataTransfer {
  return {
    files,
    items: items ?? files.map(() => ({ kind: 'file', webkitGetAsEntry: () => null })),
    dropEffect: 'none',
  } as unknown as DataTransfer;
}

function setup() {
  const onFiles = vi.fn();
  const onEntries = vi.fn();
  renderWithTheme(<UploadDropzone onFiles={onFiles} onEntries={onEntries} />);

  return { onFiles, onEntries };
}

describe('UploadDropzone', () => {
  it('hands dropped files on when the browser offers no entries for them', () => {
    const { onFiles, onEntries } = setup();
    const file = new File(['%PDF-1.4'], 'scan.pdf');

    fireEvent.drop(zone(), { dataTransfer: transfer([file]) });

    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(onEntries).not.toHaveBeenCalled();
  });

  // Text or a link dragged in from another window is a drop with no files in
  // it, and indexing it would announce "0 documents ready to upload".
  it('ignores a drop with nothing in it to index', () => {
    const { onFiles, onEntries } = setup();

    fireEvent.drop(zone(), { dataTransfer: transfer([], [{ kind: 'string' }]) });

    expect(onFiles).not.toHaveBeenCalled();
    expect(onEntries).not.toHaveBeenCalled();
  });

  it('is marked as a drop target, so the shell lets its drops through', () => {
    setup();
    expect(zone()).toHaveAttribute('data-drop-target');
  });

  it('tells the browser the drop will be taken as a copy', () => {
    setup();
    const dataTransfer = transfer([]);

    fireEvent.dragOver(zone(), { dataTransfer });

    expect(dataTransfer.dropEffect).toBe('copy');
  });

  /**
   * `dragleave` fires every time the pointer crosses into a child — the icon,
   * the text, a button — so the highlight flickered all the way across the
   * panel. Only a leave that lands outside the panel itself may clear it.
   */
  it('keeps the highlight while the pointer crosses its own children', () => {
    setup();
    const panel = zone();
    const child = screen.getByText('Drop documents or a folder here');

    // The highlight is a different set of styles, and so a different class.
    const resting = panel.className;
    fireEvent.dragOver(panel, { dataTransfer: transfer([]) });
    const highlighted = panel.className;
    expect(highlighted).not.toBe(resting);

    fireEvent(panel, new MouseEvent('dragleave', { bubbles: true, relatedTarget: child }));
    expect(panel.className).toBe(highlighted);

    fireEvent(panel, new MouseEvent('dragleave', { bubbles: true, relatedTarget: null }));
    expect(panel.className).toBe(resting);
  });
});
