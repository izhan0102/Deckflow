/**
 * Decorative SVG backgrounds applied to every slide.
 *
 * Each graphic is a pure function (theme) -> SVG string sized to a 1280x720
 * viewBox. The same string is used in two places:
 *   - the on-screen preview, set as background-image via a data URI
 *   - the PPTX exporter, encoded as a PNG-equivalent slide background
 *
 * Keeping these as code (not files) lets us recolor them per theme
 * automatically and avoids extra network requests.
 */

import type { Theme } from "./themes";

export type Graphic = {
  id: string;
  name: string;
  /** Render an SVG markup string for the given theme. */
  render: (theme: Theme) => string;
  /** Optional: dim the graphic by this amount on top of slide content (0-1). */
  contentSafe?: boolean;
};

/* ------------------------------ helpers ----------------------------------- */

const W = 1280;
const H = 720;

function svgWrap(inner: string, opacity = 1): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" style="opacity:${opacity}">${inner}</svg>`;
}

function withAlpha(hex: string, alpha: number): string {
  // alpha 0..1 -> 8-digit hex
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, "0");
  return `${hex}${a}`;
}

/** Encode an SVG string for use as a CSS data URI (works with quotes and #). */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* --------------------------- graphic implementations ---------------------- */

const none: Graphic = {
  id: "none",
  name: "None",
  render: () => svgWrap(""),
  contentSafe: true,
};

const softGrid: Graphic = {
  id: "soft-grid",
  name: "Soft grid",
  render: (t) => {
    const c = withAlpha(t.fg, 0.08);
    return svgWrap(`
      <defs>
        <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${c}" stroke-width="1"/>
        </pattern>
        <radialGradient id="m" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="white" stop-opacity="1"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <mask id="fade"><rect width="100%" height="100%" fill="url(#m)"/></mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" mask="url(#fade)"/>
    `);
  },
  contentSafe: true,
};

const diagonalStripes: Graphic = {
  id: "diagonal-stripes",
  name: "Diagonal stripes",
  render: (t) => {
    const a = withAlpha(t.accent, 0.18);
    return svgWrap(`
      <g transform="translate(${W - 380} ${-80}) rotate(35)">
        ${Array.from({ length: 9 }).map((_, i) => `<rect x="${i * 28}" y="0" width="10" height="640" fill="${a}"/>`).join("")}
      </g>
    `);
  },
  contentSafe: true,
};

const bauhaus: Graphic = {
  id: "bauhaus",
  name: "Bauhaus shapes",
  render: (t) => {
    const a = withAlpha(t.accent, 0.85);
    const m = withAlpha(t.muted, 0.6);
    return svgWrap(`
      <circle cx="${W - 150}" cy="${H - 110}" r="120" fill="${a}"/>
      <circle cx="${W - 150}" cy="${H - 110}" r="120" fill="white" fill-opacity="0" stroke="${m}" stroke-width="2"/>
      <polygon points="${W - 320},${H - 40} ${W - 220},${H - 40} ${W - 270},${H - 130}" fill="${m}"/>
      <line x1="${W - 360}" y1="${H - 40}" x2="${W - 60}" y2="${H - 40}" stroke="${a}" stroke-width="3"/>
    `, 0.85);
  },
};

const wave: Graphic = {
  id: "wave",
  name: "Wave",
  render: (t) => {
    const a = withAlpha(t.accent, 0.18);
    const a2 = withAlpha(t.accent, 0.08);
    return svgWrap(`
      <path d="M0 ${H - 110} C 240 ${H - 200}, 520 ${H - 30}, 760 ${H - 120} S 1200 ${H - 200}, ${W} ${H - 80} L ${W} ${H} L 0 ${H} Z" fill="${a2}"/>
      <path d="M0 ${H - 60}  C 240 ${H - 140}, 520 ${H + 20}, 760 ${H - 70}  S 1200 ${H - 140}, ${W} ${H - 30} L ${W} ${H} L 0 ${H} Z" fill="${a}"/>
    `);
  },
};

const topographic: Graphic = {
  id: "topographic",
  name: "Topographic",
  render: (t) => {
    const c = withAlpha(t.accent, 0.18);
    const lines = Array.from({ length: 9 }).map((_, i) => {
      const r = 80 + i * 60;
      return `<circle cx="${W * 0.18}" cy="${H * 0.78}" r="${r}" fill="none" stroke="${c}" stroke-width="1"/>`;
    }).join("");
    return svgWrap(lines);
  },
  contentSafe: true,
};

const dotField: Graphic = {
  id: "dot-field",
  name: "Dot field",
  render: (t) => {
    const c = withAlpha(t.accent, 0.5);
    const dots: string[] = [];
    for (let y = 0; y < H; y += 32) {
      for (let x = 0; x < W; x += 32) {
        // density fades from top-right to bottom-left
        const fade = 1 - (x / W) * 0.6 - ((H - y) / H) * 0.4;
        if (fade < 0.15) continue;
        const r = 1 + fade * 2;
        dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${fade}"/>`);
      }
    }
    return svgWrap(dots.join(""));
  },
  contentSafe: true,
};

const memphis: Graphic = {
  id: "memphis",
  name: "Memphis",
  render: (t) => {
    const a = withAlpha(t.accent, 0.7);
    const m = withAlpha(t.muted, 0.55);
    return svgWrap(`
      <circle cx="120" cy="120" r="36" fill="${a}"/>
      <g transform="translate(${W - 200} 80) rotate(20)">
        ${Array.from({ length: 6 }).map((_, i) => `<rect x="${i * 14}" y="0" width="6" height="40" fill="${m}"/>`).join("")}
      </g>
      <path d="M 120 ${H - 130} q 30 -40 60 0 t 60 0 t 60 0" stroke="${a}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <polygon points="${W - 200},${H - 80} ${W - 130},${H - 80} ${W - 165},${H - 145}" fill="${a}"/>
      <circle cx="${W * 0.6}" cy="60" r="14" fill="${m}"/>
      <circle cx="${W * 0.65}" cy="60" r="14" fill="white" fill-opacity="0" stroke="${m}" stroke-width="2"/>
    `, 0.85);
  },
};

const meshGradient: Graphic = {
  id: "mesh-gradient",
  name: "Mesh gradient",
  render: (t) => {
    const a = withAlpha(t.accent, 0.7);
    const m = withAlpha(t.muted, 0.55);
    return svgWrap(`
      <defs>
        <radialGradient id="b1" cx="20%" cy="30%" r="40%">
          <stop offset="0%" stop-color="${a}"/>
          <stop offset="100%" stop-color="${a}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="b2" cx="80%" cy="80%" r="50%">
          <stop offset="0%" stop-color="${m}"/>
          <stop offset="100%" stop-color="${m}" stop-opacity="0"/>
        </radialGradient>
        <filter id="bl"><feGaussianBlur stdDeviation="40"/></filter>
      </defs>
      <g filter="url(#bl)">
        <rect width="100%" height="100%" fill="url(#b1)"/>
        <rect width="100%" height="100%" fill="url(#b2)"/>
      </g>
    `, 0.85);
  },
  contentSafe: true,
};

const blueprint: Graphic = {
  id: "blueprint",
  name: "Blueprint",
  render: (t) => {
    const c = withAlpha(t.accent, 0.18);
    const c2 = withAlpha(t.accent, 0.35);
    return svgWrap(`
      <defs>
        <pattern id="bp-fine" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${c}" stroke-width="0.5"/>
        </pattern>
        <pattern id="bp-bold" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="${c2}" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bp-fine)"/>
      <rect width="100%" height="100%" fill="url(#bp-bold)"/>
    `);
  },
  contentSafe: true,
};

const halftone: Graphic = {
  id: "halftone",
  name: "Halftone",
  render: (t) => {
    const c = withAlpha(t.accent, 0.6);
    const dots: string[] = [];
    for (let y = 0; y < H; y += 18) {
      for (let x = 0; x < W; x += 18) {
        const fade = (x / W) * 0.9 + 0.1;
        const r = (1 - fade) * 5.5;
        if (r < 0.4) continue;
        dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`);
      }
    }
    return svgWrap(dots.join(""));
  },
  contentSafe: true,
};

const mosaic: Graphic = {
  id: "mosaic",
  name: "Geometric mosaic",
  render: (t) => {
    const a = withAlpha(t.accent, 0.18);
    const a2 = withAlpha(t.accent, 0.35);
    const m = withAlpha(t.muted, 0.18);
    const triangles: string[] = [];
    const cols = 9, rows = 5;
    const cw = W / cols, rh = H / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw, y = r * rh;
        const flip = (r + c) % 2 === 0;
        const fill = (r + c * 3) % 5 === 0 ? a2 : (r + c) % 3 === 0 ? a : m;
        if (flip) {
          triangles.push(`<polygon points="${x},${y} ${x + cw},${y} ${x},${y + rh}" fill="${fill}"/>`);
        } else {
          triangles.push(`<polygon points="${x + cw},${y} ${x + cw},${y + rh} ${x},${y + rh}" fill="${fill}"/>`);
        }
      }
    }
    return svgWrap(triangles.join(""), 0.55);
  },
};

/* --------------------------- new corner / frame set --------------------------- */

const cornerArc: Graphic = {
  id: "corner-arc",
  name: "Corner arc",
  render: (t) => {
    const a = withAlpha(t.accent, 0.25);
    const a2 = withAlpha(t.accent, 0.5);
    return svgWrap(`
      <path d="M ${W} 0 A ${W * 0.55} ${W * 0.55} 0 0 0 ${W * 0.45} 0 Z" fill="${a}"/>
      <path d="M 0 ${H} A ${W * 0.4} ${W * 0.4} 0 0 0 ${W * 0.4} ${H} Z" fill="${a2}"/>
    `);
  },
  contentSafe: true,
};

const cornerBlocks: Graphic = {
  id: "corner-blocks",
  name: "Corner blocks",
  render: (t) => {
    const a = withAlpha(t.accent, 0.7);
    const m = withAlpha(t.muted, 0.45);
    return svgWrap(`
      <rect x="0" y="0" width="160" height="14" fill="${a}"/>
      <rect x="0" y="0" width="14" height="160" fill="${a}"/>
      <rect x="${W - 160}" y="${H - 14}" width="160" height="14" fill="${m}"/>
      <rect x="${W - 14}" y="${H - 160}" width="14" height="160" fill="${m}"/>
    `);
  },
  contentSafe: true,
};

const sideBar: Graphic = {
  id: "side-bar",
  name: "Side bar",
  render: (t) => {
    const a = withAlpha(t.accent, 0.18);
    const a2 = t.accent;
    return svgWrap(`
      <rect x="0" y="0" width="${W * 0.18}" height="${H}" fill="${a}"/>
      <rect x="${W * 0.18 - 4}" y="0" width="4" height="${H}" fill="${a2}"/>
    `);
  },
  contentSafe: true,
};

const splitDiagonal: Graphic = {
  id: "split-diagonal",
  name: "Diagonal split",
  render: (t) => {
    const a = withAlpha(t.accent, 0.12);
    return svgWrap(`
      <polygon points="0,0 ${W * 0.6},0 ${W * 0.4},${H} 0,${H}" fill="${a}"/>
    `);
  },
  contentSafe: true,
};

const ribbonStripe: Graphic = {
  id: "ribbon-stripe",
  name: "Ribbon stripe",
  render: (t) => {
    const a = t.accent;
    const m = withAlpha(t.muted, 0.5);
    return svgWrap(`
      <rect x="0" y="${H * 0.08}" width="${W}" height="6" fill="${a}"/>
      <rect x="0" y="${H * 0.92 - 6}" width="${W}" height="6" fill="${m}"/>
    `);
  },
  contentSafe: true,
};

const cornerCircles: Graphic = {
  id: "corner-circles",
  name: "Corner circles",
  render: (t) => {
    const a = withAlpha(t.accent, 0.85);
    const m = withAlpha(t.muted, 0.65);
    return svgWrap(`
      <circle cx="0"   cy="0"   r="120" fill="${a}"/>
      <circle cx="${W}" cy="${H}" r="160" fill="${m}"/>
    `);
  },
  contentSafe: true,
};

const minimalDivider: Graphic = {
  id: "minimal-divider",
  name: "Minimal divider",
  render: (t) => {
    const c = withAlpha(t.fg, 0.18);
    const a = t.accent;
    return svgWrap(`
      <line x1="${W * 0.06}" y1="${H - 28}" x2="${W * 0.94}" y2="${H - 28}" stroke="${c}" stroke-width="1"/>
      <rect x="${W * 0.06}" y="${H - 32}" width="48" height="6" fill="${a}"/>
    `);
  },
  contentSafe: true,
};

const archCorner: Graphic = {
  id: "arch-corner",
  name: "Arch corner",
  render: (t) => {
    const a = withAlpha(t.accent, 0.85);
    return svgWrap(`
      <path d="M 0 ${H} L 0 ${H * 0.55} A ${W * 0.18} ${W * 0.18} 0 0 1 ${W * 0.36} ${H * 0.55} L ${W * 0.36} ${H} Z" fill="${a}"/>
    `);
  },
};

const concentric: Graphic = {
  id: "concentric",
  name: "Concentric arcs",
  render: (t) => {
    const c = withAlpha(t.accent, 0.18);
    return svgWrap(`
      <circle cx="${W}" cy="${H * 0.5}" r="220" fill="none" stroke="${c}" stroke-width="2"/>
      <circle cx="${W}" cy="${H * 0.5}" r="320" fill="none" stroke="${c}" stroke-width="2"/>
      <circle cx="${W}" cy="${H * 0.5}" r="420" fill="none" stroke="${c}" stroke-width="2"/>
      <circle cx="${W}" cy="${H * 0.5}" r="520" fill="none" stroke="${c}" stroke-width="2"/>
    `);
  },
  contentSafe: true,
};

const editorialGrid: Graphic = {
  id: "editorial-grid",
  name: "Editorial grid",
  render: (t) => {
    const c = withAlpha(t.fg, 0.1);
    const a = t.accent;
    return svgWrap(`
      <line x1="${W * 0.5}" y1="0" x2="${W * 0.5}" y2="${H}" stroke="${c}"/>
      <line x1="${W * 0.06}" y1="0" x2="${W * 0.06}" y2="${H}" stroke="${c}"/>
      <line x1="${W * 0.94}" y1="0" x2="${W * 0.94}" y2="${H}" stroke="${c}"/>
      <line x1="0" y1="${H * 0.12}" x2="${W}" y2="${H * 0.12}" stroke="${c}"/>
      <line x1="0" y1="${H * 0.88}" x2="${W}" y2="${H * 0.88}" stroke="${c}"/>
      <rect x="${W * 0.06}" y="${H * 0.12 - 3}" width="40" height="6" fill="${a}"/>
    `);
  },
  contentSafe: true,
};

/* --------------------------- soft / organic ------------------------------ */

const organicSage: Graphic = {
  id: "organic-sage",
  name: "Soft sage blobs",
  render: (t) => {
    // The graphic owns its decorative palette — sage tones come from
    // theme.accent so it adapts when other themes pick this graphic, but
    // the cream / blush / gold values are fixed so the design always
    // reads the way it was drawn. We deliberately do NOT use theme.muted
    // here, because some themes need that role free for readable
    // secondary text.
    const sageDeep = withAlpha(t.accent, 0.85);
    const sageMid  = withAlpha(t.accent, 0.55);
    const sageSoft = withAlpha(t.accent, 0.30);
    const cream    = "#F1E5D6";              // warm beige blob
    const creamSoft= "#F5EBDC";              // softer cream layer
    const blush    = "#E8C9B5";              // peachy blush
    const gold     = "#C9A45B";              // satin gold for thin curves
    const goldSoft = withAlpha("#C9A45B", 0.75);

    // 5x5 dot-grid pattern. Reused at four corners.
    const dotGrid = (cx: number, cy: number, r = 24, alpha = 1) => {
      const pts: string[] = [];
      const step = r / 4;
      const fill = withAlpha(t.fg, 0.32 * alpha);
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const x = cx + (col - 2) * step;
          const y = cy + (row - 2) * step;
          pts.push(`<circle cx="${x}" cy="${y}" r="1.6" fill="${fill}"/>`);
        }
      }
      return pts.join("");
    };

    // Diagonal hatch pattern, rotated 35°. Used inside corner accent
    // circles to match the reference style — thin parallel sage strokes.
    const hatchDef = `
      <pattern id="org-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="${sageDeep}" stroke-width="1.2"/>
      </pattern>
      <pattern id="org-hatch-blush" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="${blush}" stroke-width="1.4"/>
      </pattern>
    `;

    // A circle filled with parallel-line hatching, used in corners.
    // Two variants — sage and blush — so opposite corners can differ.
    const hatchedCircle = (cx: number, cy: number, r: number, kind: "sage" | "blush") => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#org-hatch${kind === "blush" ? "-blush" : ""})" opacity="0.9"/>
    `;

    // Botanical leaf sprig — stem with three pairs of teardrop leaves.
    // Renders inside a 200x200 box so we can position with translate.
    const leafSprig = (color: string) => `
      <g fill="${color}">
        <path d="M 100 200 C 96 150, 100 100, 110 50" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M 100 170 C 70 168, 50 150, 40 130 C 70 132, 92 148, 100 170 Z"/>
        <path d="M 100 170 C 130 168, 150 150, 160 130 C 130 132, 108 148, 100 170 Z"/>
        <path d="M 102 130 C 78 128, 60 110, 52 92 C 78 96, 98 112, 102 130 Z"/>
        <path d="M 102 130 C 126 128, 144 110, 152 92 C 126 96, 106 112, 102 130 Z"/>
        <path d="M 106 90 C 88 88, 74 72, 70 56 C 88 60, 102 76, 106 90 Z"/>
        <path d="M 106 90 C 124 88, 138 72, 142 56 C 124 60, 110 76, 106 90 Z"/>
      </g>
    `;

    return svgWrap(`
      <defs>${hatchDef}</defs>

      <!-- ============ TOP-LEFT corner: sage blob + gold curves ============ -->
      <path d="M -60 -40 C 240 -50, 420 70, 380 230
               C 340 380, 160 360, 60 320
               C -60 270, -120 140, -60 -40 Z"
            fill="${sageSoft}"/>
      <path d="M 40 -40 C 260 -10, 360 70, 300 200
               C 240 320, 80 300, 0 220
               C -60 160, -40 60, 40 -40 Z"
            fill="${sageMid}"/>

      <!-- gold curves cutting through the top-left blob -->
      <path d="M -20 80 C 120 70, 240 130, 360 100"
            stroke="${gold}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M -20 130 C 100 130, 220 180, 340 150"
            stroke="${goldSoft}" stroke-width="1.2" fill="none" stroke-linecap="round"/>

      <!-- TOP-LEFT: hatched sage circle tucked into the corner blob -->
      ${hatchedCircle(110, 130, 56, "sage")}

      <!-- TOP-LEFT dot grid -->
      ${dotGrid(70, 70, 26)}

      <!-- ============ TOP-RIGHT corner: hatched circle + sage blob + leaf ============ -->
      <!-- the marquee corner accent: a large hatched circle straddling the corner -->
      ${hatchedCircle(W - 80, 80, 90, "blush")}

      <path d="M ${W + 60} -40 C ${W - 200} -30, ${W - 360} 60, ${W - 320} 220
               C ${W - 280} 340, ${W - 80} 320, ${W + 60} 240 Z"
            fill="${sageDeep}" opacity="0.78"/>

      <!-- gold curve sweeping into the top-right blob -->
      <path d="M ${W - 540} 50 C ${W - 380} 30, ${W - 220} 90, ${W - 80} 60"
            stroke="${gold}" stroke-width="1.4" fill="none" stroke-linecap="round"/>

      <!-- leaf sprig, top-right corner -->
      <g transform="translate(${W - 220} -40) rotate(28 100 100) scale(1.05)">
        ${leafSprig(sageDeep)}
      </g>

      <!-- TOP-RIGHT dot grid -->
      ${dotGrid(W - 110, 230, 24, 0.85)}

      <!-- ============ BOTTOM-LEFT corner: cream + blush blobs + leaf + hatched circle ============ -->
      <path d="M -60 ${H + 40} C 100 ${H - 60}, 280 ${H - 40}, 280 ${H - 200}
               C 280 ${H - 360}, 60 ${H - 320}, -80 ${H - 200} Z"
            fill="${cream}"/>
      <path d="M -40 ${H + 40} C 120 ${H - 40}, 240 ${H - 60}, 260 ${H - 200}
               C 280 ${H - 340}, 80 ${H - 280}, -60 ${H - 180} Z"
            fill="${creamSoft}" opacity="0.95"/>
      <path d="M 60 ${H - 30} C 160 ${H - 60}, 240 ${H - 100}, 260 ${H - 180}"
            stroke="${blush}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/>

      <!-- BOTTOM-LEFT: hatched blush circle at the very corner -->
      ${hatchedCircle(60, H - 60, 60, "blush")}

      <!-- gold curve sweeping under the cream blob -->
      <path d="M 40 ${H - 30} C 180 ${H + 0}, 320 ${H - 70}, 460 ${H - 20}"
            stroke="${gold}" stroke-width="1.4" fill="none" stroke-linecap="round"/>

      <!-- leaf sprig, bottom-left -->
      <g transform="translate(80 ${H - 270}) rotate(-22 100 100) scale(1.0)">
        ${leafSprig(sageDeep)}
      </g>

      <!-- BOTTOM-LEFT dot grid -->
      ${dotGrid(220, H - 60, 26, 0.85)}

      <!-- ============ BOTTOM-RIGHT corner: large layered sage blob + hatched circle ============ -->
      <path d="M ${W + 60} ${H + 40} C ${W - 60} ${H - 80}, ${W - 280} ${H - 60}, ${W - 420} ${H - 180}
               C ${W - 560} ${H - 300}, ${W - 320} ${H - 360}, ${W - 200} ${H - 300}
               C ${W - 80} ${H - 240}, ${W + 60} ${H - 80}, ${W + 60} ${H + 40} Z"
            fill="${sageDeep}" opacity="0.85"/>
      <path d="M ${W + 60} ${H + 40} C ${W - 80} ${H - 60}, ${W - 240} ${H - 60}, ${W - 360} ${H - 160}
               C ${W - 480} ${H - 260}, ${W - 280} ${H - 300}, ${W - 200} ${H - 240}
               C ${W - 100} ${H - 180}, ${W + 60} ${H - 60}, ${W + 60} ${H + 40} Z"
            fill="${sageMid}" opacity="0.75"/>

      <!-- BOTTOM-RIGHT: hatched sage circle nestled in the corner -->
      ${hatchedCircle(W - 60, H - 80, 64, "sage")}

      <!-- gold curve sweeping across the bottom-right blob -->
      <path d="M ${W - 540} ${H - 80} C ${W - 380} ${H - 130}, ${W - 220} ${H - 60}, ${W - 60} ${H - 100}"
            stroke="${gold}" stroke-width="1.5" fill="none" stroke-linecap="round"/>

      <!-- BOTTOM-RIGHT dot grid -->
      ${dotGrid(W - 200, H - 200, 28)}
    `);
  },
  contentSafe: true,
};


/* --------------------- premium template backgrounds ---------------------- *
 * Five Canva/Gamma-grade textured backgrounds. Every layer is low-opacity
 * so body text stays fully legible. Built to pair with the new template
 * palettes (aurora-night, peach-cream, deep-teal, lilac-mist, graphite-gold).
 * -------------------------------------------------------------------------- */

const auroraFlow: Graphic = {
  id: "aurora-flow",
  name: "Aurora flow",
  render: (t) => {
    const a1 = withAlpha(t.accent, 0.30);
    const a3 = withAlpha(t.accent, 0.14);
    const fgGrid = withAlpha(t.fg, 0.06);
    const base = t.accent.slice(0, 7);
    return svgWrap(`
      <defs>
        <radialGradient id="au1" cx="20%" cy="16%" r="55%">
          <stop offset="0%" stop-color="${a1}"/>
          <stop offset="100%" stop-color="${base}00"/>
        </radialGradient>
        <radialGradient id="au2" cx="86%" cy="90%" r="60%">
          <stop offset="0%" stop-color="${withAlpha("#F472B6", 0.18)}"/>
          <stop offset="100%" stop-color="#F472B600"/>
        </radialGradient>
        <radialGradient id="au3" cx="80%" cy="10%" r="46%">
          <stop offset="0%" stop-color="${a3}"/>
          <stop offset="100%" stop-color="${base}00"/>
        </radialGradient>
        <pattern id="audots" width="34" height="34" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.3" fill="${fgGrid}"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#audots)"/>
      <rect width="100%" height="100%" fill="url(#au1)"/>
      <rect width="100%" height="100%" fill="url(#au3)"/>
      <rect width="100%" height="100%" fill="url(#au2)"/>
    `);
  },
  contentSafe: true,
};

const warmGrain: Graphic = {
  id: "warm-grain",
  name: "Warm grain",
  render: (t) => {
    const soft = withAlpha(t.accent, 0.12);
    const softer = withAlpha(t.accent, 0.07);
    const grain = withAlpha(t.fg, 0.05);
    const arc = withAlpha(t.accent, 0.45);
    const base = t.accent.slice(0, 7);
    return svgWrap(`
      <defs>
        <radialGradient id="wg1" cx="86%" cy="10%" r="52%">
          <stop offset="0%" stop-color="${soft}"/>
          <stop offset="100%" stop-color="${base}00"/>
        </radialGradient>
        <radialGradient id="wg2" cx="8%" cy="96%" r="56%">
          <stop offset="0%" stop-color="${softer}"/>
          <stop offset="100%" stop-color="${base}00"/>
        </radialGradient>
        <pattern id="wgGrain" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1.4" r="0.7" fill="${grain}"/>
          <circle cx="4" cy="3.6" r="0.6" fill="${grain}"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wg1)"/>
      <rect width="100%" height="100%" fill="url(#wg2)"/>
      <rect width="100%" height="100%" fill="url(#wgGrain)"/>
      <path d="M ${W - 470} -50 A 500 500 0 0 1 ${W + 40} 450" fill="none" stroke="${arc}" stroke-width="1.4"/>
      <path d="M ${W - 540} -50 A 560 560 0 0 1 ${W + 40} 520" fill="none" stroke="${withAlpha(t.accent, 0.22)}" stroke-width="1.2"/>
    `);
  },
  contentSafe: true,
};

const prismGlass: Graphic = {
  id: "prism-glass",
  name: "Prism glass",
  render: (t) => {
    const c1 = withAlpha(t.accent, 0.16);
    const c2 = withAlpha(t.accent, 0.09);
    const line = withAlpha(t.fg, 0.05);
    return svgWrap(`
      <defs>
        <pattern id="pgl" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="26" stroke="${line}" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#pgl)"/>
      <circle cx="${W - 150}" cy="120" r="230" fill="${c1}"/>
      <circle cx="${W - 10}" cy="340" r="160" fill="${c2}"/>
      <circle cx="130" cy="${H - 90}" r="210" fill="${c2}"/>
      <circle cx="-40" cy="${H - 280}" r="150" fill="${c1}"/>
    `);
  },
  contentSafe: true,
};

const lilacBloom: Graphic = {
  id: "lilac-bloom",
  name: "Lilac bloom",
  render: (t) => {
    const a = withAlpha(t.accent, 0.16);
    const pink = withAlpha("#EC4899", 0.10);
    const plus = withAlpha(t.fg, 0.07);
    return svgWrap(`
      <defs>
        <filter id="lbBlur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="42"/>
        </filter>
        <pattern id="lbPlus" width="46" height="46" patternUnits="userSpaceOnUse">
          <path d="M23 18 V28 M18 23 H28" stroke="${plus}" stroke-width="1.2"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#lbPlus)"/>
      <g filter="url(#lbBlur)">
        <circle cx="170" cy="140" r="190" fill="${a}"/>
        <circle cx="${W - 150}" cy="${H - 110}" r="230" fill="${pink}"/>
        <circle cx="${W - 250}" cy="70" r="120" fill="${a}"/>
      </g>
    `);
  },
  contentSafe: true,
};

const luxFrame: Graphic = {
  id: "lux-frame",
  name: "Lux frame",
  render: (t) => {
    const goldSoft = withAlpha(t.accent, 0.5);
    const goldFaint = withAlpha(t.accent, 0.22);
    const line = withAlpha(t.fg, 0.05);
    const dot = withAlpha(t.accent, 0.55);
    const dots = (cx: number, cy: number) =>
      Array.from({ length: 16 }).map((_, i) => {
        const r = Math.floor(i / 4), c = i % 4;
        return `<circle cx="${cx + c * 11}" cy="${cy + r * 11}" r="1.4" fill="${dot}"/>`;
      }).join("");
    return svgWrap(`
      <defs>
        <pattern id="lfv" width="50" height="50" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="50" stroke="${line}" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#lfv)"/>
      <rect x="30" y="30" width="${W - 60}" height="${H - 60}" fill="none" stroke="${goldSoft}" stroke-width="1"/>
      <rect x="37" y="37" width="${W - 74}" height="${H - 74}" fill="none" stroke="${goldFaint}" stroke-width="1"/>
      ${dots(58, 58)}
      ${dots(W - 100, H - 90)}
    `);
  },
  contentSafe: true,
};


export const GRAPHICS: Graphic[] = [
  none,
  // New premium template backgrounds — first so they land on page 1.
  auroraFlow,
  warmGrain,
  prismGlass,
  lilacBloom,
  luxFrame,
  // New — soft organic style. Sits high in the catalog so it shows up
  // on page 1 of the graphic picker for the new "Sage & Blush" template.
  organicSage,
  softGrid,
  meshGradient,
  diagonalStripes,
  dotField,
  topographic,
  blueprint,
  halftone,
  bauhaus,
  memphis,
  wave,
  mosaic,
  // Corner / frame additions
  cornerArc,
  cornerBlocks,
  sideBar,
  splitDiagonal,
  ribbonStripe,
  cornerCircles,
  minimalDivider,
  archCorner,
  concentric,
  editorialGrid,
];

export function getGraphic(id?: string): Graphic {
  return GRAPHICS.find((g) => g.id === id) || none;
}
