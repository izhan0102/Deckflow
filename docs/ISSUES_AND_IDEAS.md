# EXdeck — Issues & Ideas

A running list of issues and ideas to work through one by one.
Status: `todo` / `in-progress` / `done`

---

## 1. PDF export: timeline step numbers not centered  ·  `done`

**Type:** Bug

**Where:** PDF export (numbered circles, e.g. a vertical timeline / steps layout — `01`, `02`, `03`...).

**What happens:** In the exported PDF, the number inside each circular badge
is not vertically/horizontally centered within the circle. The digits sit
slightly off (low / left of center) instead of being perfectly centered.

**Expected:** Each number should be perfectly centered inside its circle in
the exported PDF, matching the on-screen preview.

**Notes / leads:**
- PDF export path: `lib/pdfExport.ts` (renders the hidden DOM slides via
  `HiddenSlidesRenderer`).
- The on-screen render likely looks fine, so this is probably a
  rasterization / line-height / flex-centering quirk that only shows in the
  PDF capture. Check the numbered-badge component in `SlideCanvas.tsx`
  (timeline / steps layout) for `line-height`, `display:flex` centering, or
  baseline offset that html-to-canvas handles differently.

---

## 2. PDF export: chart slides render blank (chart not visible)  ·  `done`

**Type:** Bug

**Where:** PDF export of a `chart` layout slide (e.g. "Temperature Rise in
Kashmir" / "Temperature Trends Over Time").

**What happens:** In the exported PDF, the chart is completely missing — the
slide shows only the title, subtitle, footer, and background, with a large
empty area where the chart should be. The chart renders fine in the on-screen
preview but does not appear in the captured PDF.

**Expected:** The chart should appear in the exported PDF exactly as it does
in the preview.

**Notes / leads:**
- PDF export path: `lib/pdfExport.ts` rasterizes the hidden DOM slides from
  `HiddenSlidesRenderer`.
- Chart is likely drawn on a `<canvas>` (or SVG / async-rendered) that hasn't
  painted by the time html-to-image/canvas captures the node, so it serializes
  as blank. Check how charts are rendered in `SlideCanvas.tsx` and whether the
  PDF capture waits for the chart to finish drawing.
- Confirm the chart element isn't relying on something html2canvas/the capture
  lib can't read (e.g. live `<canvas>` pixels, web fonts, or CSS the snapshot
  drops).

---
