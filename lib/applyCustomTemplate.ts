/**
 * Re-skin a generated deck so it follows a user-designed custom template
 * EXACTLY. This overrides the default visual look (colors, fonts,
 * background, decorations) without touching the AI's content/structure.
 */
import type { Deck, Slide, UploadedImage } from "./types";
import type { Theme } from "./themes";
import type { CustomTemplate } from "./customTemplates";
import { resolveFontFamily } from "./fonts";

/** Build a Theme object from a custom template's colors. */
export function themeFromCustomTemplate(tpl: CustomTemplate): Theme {
  return {
    id: `custom_${tpl.id}`,
    name: tpl.name || "Custom",
    bg: tpl.colors.bg,
    fg: tpl.colors.fg,
    accent: tpl.colors.accent,
    muted: tpl.colors.muted,
    font: tpl.fontCategory || "sans",
  };
}

/** A fresh copy of the template's decoration set with new ids per slide. */
function freshDecorations(decos: UploadedImage[]): UploadedImage[] {
  return (decos || []).map((d) => ({
    ...d,
    id: `tpl_${Math.random().toString(36).slice(2, 8)}`,
  }));
}

/**
 * Apply the template to every slide of the deck. Returns a new deck +
 * the theme to render it with. Content (titles/bullets/etc.) is untouched.
 */
export function applyCustomTemplateToDeck(deck: Deck, tpl: CustomTemplate): { deck: Deck; theme: Theme } {
  const theme = themeFromCustomTemplate(tpl);
  const bg = tpl.background || { kind: "none" };

  // Deck-level background: a graphic maps to the deck.graphic slot the
  // renderer already understands; pattern/image are applied per slide.
  const graphic = bg.kind === "graphic" ? (bg.graphicId || "none") : "none";
  const graphicAccent = bg.kind === "graphic" ? bg.graphicAccent : undefined;

  const slides: Slide[] = deck.slides.map((s) => {
    const next: Slide = { ...s };

    // Per-role font overrides via the rich-text whole-element font-family.
    // We don't rewrite the text HTML here; instead the renderer reads
    // slide.fontId / element fonts. Simpler + robust: set the deck font and
    // let per-role pickers ride on element font sizes. We store per-role
    // fonts on the slide so SlideCanvas can pick them up.
    next.templateFonts = tpl.fonts;

    // Background pattern (per slide).
    if (bg.kind === "pattern" && bg.patternId) {
      next.pattern = {
        id: bg.patternId,
        color: bg.patternColor || tpl.colors.fg,
        opacity: bg.patternOpacity ?? 0.08,
      };
    } else {
      next.pattern = undefined;
    }

    // Uploaded image background → a full-bleed decoration image behind text.
    const baseImages = (s.uploadedImages || []).filter((im) => im.kind !== "templateBg");
    const tplImages: UploadedImage[] = [];
    if (bg.kind === "image" && bg.imageDataUrl) {
      tplImages.push({
        id: `tplbg_${Math.random().toString(36).slice(2, 8)}`,
        kind: "templateBg",
        dataUrl: bg.imageDataUrl,
        opacity: bg.imageOpacity ?? 1,
        x: 0, y: 0, w: 13.333, h: 7.5,
      });
    }
    // Decorations defined in the template, fresh per slide.
    const decos = freshDecorations(tpl.decorations || []);

    next.uploadedImages = [...tplImages, ...baseImages, ...decos];
    return next;
  });

  return {
    deck: { ...deck, slides, graphic, graphicAccent, fontId: tpl.fonts.body || deck.fontId },
    theme,
  };
}
