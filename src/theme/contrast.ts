/** WCAG 2.1 minimum for normal-size text. */
export const AA_TEXT = 4.5;

/** WCAG 2.1 minimum for icons, borders and other non-text UI. */
export const AA_UI = 3;

// Expands a hex colour into its 0-255 channels.
function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '');

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Expected a six-digit hex colour, received "${hex}"`);
  }

  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

// Removes the sRGB transfer curve so channels can be averaged meaningfully.
function linearize(channel: number): number {
  const ratio = channel / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

// Relative luminance of a colour, per WCAG 2.1.
export function relativeLuminance(hex: string): number {
  const [red, green, blue] = channels(hex);
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

// Contrast between two colours, from 1 (identical) to 21 (black on white).
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);

  return (lighter + 0.05) / (darker + 0.05);
}

// Reports whether a pairing is legible at the given threshold.
export function meetsContrast(foreground: string, background: string, minimum: number): boolean {
  return contrastRatio(foreground, background) >= minimum;
}

/**
 * Composites a translucent colour over an opaque one. Chips tint their
 * background with a low-alpha fill, so the pairing a reader actually sees is the
 * ink against this blend, not against the bare surface.
 */
export function blend(foreground: string, background: string, alpha: number): string {
  const fg = channels(foreground);
  const bg = channels(background);
  const mixed = fg.map((value, i) => Math.round(value * alpha + (bg[i] as number) * (1 - alpha)));

  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
