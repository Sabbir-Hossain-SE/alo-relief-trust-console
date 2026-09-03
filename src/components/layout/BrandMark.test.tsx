import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { expectNoViolations } from '@/test/axe';
import { renderWithTheme } from '@/test/render';
import { BrandMark } from './BrandMark';

describe('BrandMark', () => {
  it('names the trust', () => {
    renderWithTheme(<BrandMark />);

    expect(screen.getByText('Alo Relief Trust')).toBeInTheDocument();
    expect(screen.getByText('Document console')).toBeInTheDocument();
  });

  it('drops the second line where there is one line of room', () => {
    renderWithTheme(<BrandMark compact />);

    expect(screen.getByText('Alo Relief Trust')).toBeInTheDocument();
    expect(screen.queryByText('Document console')).not.toBeInTheDocument();
  });

  // The wordmark beside it already says what this is, so the drawing is
  // decoration as far as a screen reader is concerned.
  it('hides the drawing from assistive technology', () => {
    const { container } = renderWithTheme(<BrandMark />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  /**
   * The small-screen drawer keeps its content mounted, so the mark renders
   * twice on one page. A fixed gradient id would be a duplicate in the
   * document, and `url(#id)` resolves against the first match — which is a
   * detached node once the drawer unmounts.
   */
  it('gives each instance its own gradient', () => {
    const { container } = renderWithTheme(
      <>
        <BrandMark />
        <BrandMark compact />
      </>,
    );

    const ids = [...container.querySelectorAll('linearGradient')].map((node) => node.id);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it('points each sun at its own gradient', () => {
    const { container } = renderWithTheme(<BrandMark />);

    const gradient = container.querySelector('linearGradient')?.id;
    expect(container.querySelector('path')).toHaveAttribute('fill', `url(#${gradient})`);
  });

  /**
   * `fill` is not one of the properties MUI maps to palette keys, so a token
   * name is emitted as a raw CSS value; and reading `palette` rather than
   * `vars` bakes whichever scheme rendered first into the stylesheet, leaving
   * the mark unchanged when the operator uses the theme toggle. Both mistakes
   * were made on the way here, and both look correct in a light-mode test.
   */
  it('paints the horizon from the scheme variable, not a literal or a token name', () => {
    const { container } = renderWithTheme(<BrandMark />);
    const horizon = container.querySelector('rect') as SVGRectElement;

    const emitted = [...document.querySelectorAll('style')]
      .map((style) => style.textContent ?? '')
      .join('\n');
    const rule = emitted
      .split('}')
      .find((chunk) => [...horizon.classList].some((name) => chunk.includes(`.${name}`)));

    expect(rule).toContain('--mui-palette-brandHorizon');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithTheme(<BrandMark />);

    await expectNoViolations(container);
  });
});
