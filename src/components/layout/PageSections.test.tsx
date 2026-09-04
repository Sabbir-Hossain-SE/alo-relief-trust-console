import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/render';
import { PageHeader } from './PageHeader';
import { PageSections, SECTION_CONTENT_GAP } from './PageSections';

describe('PageSections', () => {
  it('stacks its children', () => {
    const { container } = renderWithTheme(
      <PageSections>
        <div>one</div>
        <div>two</div>
      </PageSections>,
    );

    expect(container.firstElementChild).toHaveClass('flex', 'flex-col');
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
  });

  /**
   * "These belong together" and "these are separate things" have to read as
   * different distances. When they were the same number, or when each block
   * carried its own margin, a page ended up with four gaps that all looked like
   * mistakes.
   */
  it('separates sections by more than the blocks inside one', () => {
    const gapOf = (className: string) => Number(/gap-(\d+)/.exec(className)?.[1]);

    const { container } = renderWithTheme(<PageSections>{null}</PageSections>);
    const sectionGap = gapOf(container.firstElementChild?.className ?? '');

    expect(sectionGap).toBeGreaterThan(gapOf(SECTION_CONTENT_GAP));
  });

  /**
   * The gap belongs to the stack, not to the header. A margin here plus a gap
   * there is how the distance below a title stops matching the distance between
   * everything else.
   */
  it('leaves the header carrying no margin of its own', () => {
    const { container } = renderWithTheme(<PageHeader title="Documents" />);

    expect(container.firstElementChild?.className).not.toMatch(/\bmb-\d/);
  });
});
