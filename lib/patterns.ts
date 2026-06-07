/**
 * Per-slide background PATTERNS.
 *
 * Distinct from lib/graphics.ts (deck-wide decorative backgrounds): a pattern
 * is a subtle, tiling texture the user adds to a SINGLE slide from the editor
 * toolbar. It sits behind all content at low opacity so text stays readable,
 * tiles across the whole slide, and can be recolored or removed.
 *
 * Each pattern is a pure function (color) -> SVG string on a 1280x720 viewBox.
 * The same string is used for the on-screen preview and (via a data URI) for
 * PDF/PPTX export, so it renders identically everywhere.
 */

const W = 1280;
const H = 720;

function wrap(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
}

export type SlidePattern = {
  id: string;
  name: string;
  /** Render SVG markup tinted with the given color. */
  render: (color: string) => string;
};

/** Opacity the pattern layer is drawn at, so text above stays readable. */
export const PATTERN_OPACITY = 0.08;

export const SLIDE_PATTERNS: SlidePattern[] = [
  {
    id: "dots",
    name: "Dots",
    render: (c) => wrap(`
      <defs><pattern id="p" width="32" height="32" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="2.4" fill="${c}"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#p)"/>`),
  },
  {
    id: "grid",
    name: "Grid",
    render: (c) => wrap(`
      <defs><pattern id="p" width="44" height="44" patternUnits="userSpaceOnUse">
        <path d="M 44 0 L 0 0 0 44" fill="none" stroke="${c}" stroke-width="1.5"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#p)"/>`),
  },
  {
    id: "diagonal",
    name: "Diagonal lines",
    render: (c) => wrap(`
      <defs><pattern id="p" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="26" stroke="${c}" stroke-width="3"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#p)"/>`),
  },
  {
    id: "crosshatch",
    name: "Crosshatch",
    render: (c) => wrap(`
      <defs><pattern id="p" width="30" height="30" patternUnits="userSpaceOnUse">
        <path d="M0 0 L30 30 M30 0 L0 30" stroke="${c}" stroke-width="1.4" fill="none"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#p)"/>`),
  },
  {
    id: "waves",
    name: "Waves",
    render: (c) => wrap(`
      <defs><pattern id="p" width="80" height="36" patternUnits="userSpaceOnUse">
        <path d="M0 18 Q 20 2 40 18 T 80 18" fill="none" stroke="${c}" stroke-width="2.5"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#p)"/>`),
  },
  {
    id: "triangles",
    name: "Triangles",
    render: (c) => wrap(`
      <defs><pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M20 6 L34 30 L6 30 Z" fill="none" stroke="${c}" stroke-width="2"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#p)"/>`),
  },
  {
    id: "plus",
    name: "Plus signs",
    render: (c) => wrap(`
      <defs><pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M20 12 L20 28 M12 20 L28 20" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#p)"/>`),
  },
  {
    id: "concentric",
    name: "Concentric",
    render: (c) => wrap(`
      <defs><pattern id="p" width="64" height="64" patternUnits="userSpaceOnUse">
        <circle cx="32" cy="32" r="6" fill="none" stroke="${c}" stroke-width="1.6"/>
        <circle cx="32" cy="32" r="16" fill="none" stroke="${c}" stroke-width="1.6"/>
        <circle cx="32" cy="32" r="26" fill="none" stroke="${c}" stroke-width="1.6"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#p)"/>`),
  },
  {
    id: "zigzag",
    name: "Zigzag",
    render: (c) => wrap(`
      <defs><pattern id="p" width="40" height="20" patternUnits="userSpaceOnUse">
        <path d="M0 16 L10 4 L20 16 L30 4 L40 16" fill="none" stroke="${c}" stroke-width="2.2"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#p)"/>`),
  },
];

export function getPattern(id?: string): SlidePattern | undefined {
  return SLIDE_PATTERNS.find((p) => p.id === id);
}

export function patternToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
