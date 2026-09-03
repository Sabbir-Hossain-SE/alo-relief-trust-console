import axe, { type ElementContext, type RunOptions } from 'axe-core';
import { expect } from 'vitest';

/**
 * Rules jsdom cannot answer honestly.
 *
 * Contrast needs real layout and computed colour, neither of which jsdom has —
 * it would report every pair as "incomplete" or, worse, pass them. Colour is
 * checked properly by `src/theme/contrast.test.ts`, which computes WCAG ratios
 * from the tokens themselves.
 */
const UNAVAILABLE_IN_JSDOM = ['color-contrast'];

const OPTIONS: RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
  rules: Object.fromEntries(UNAVAILABLE_IN_JSDOM.map((id) => [id, { enabled: false }])),
};

// Fails with the offending rule and markup rather than a bare count.
export async function expectNoViolations(container: ElementContext): Promise<void> {
  const { violations } = await axe.run(container, OPTIONS);

  const report = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.html}`).join('\n'),
  );

  expect(report, report.join('\n\n')).toEqual([]);
}
