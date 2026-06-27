"use client";
import { useMemo } from "react";
import type { Deck, Slide, SlideLayout } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import SlideCanvas from "./SlideCanvas";
import { Wand2 } from "lucide-react";
import DiagramVariants from "./DiagramVariants";

/**
 * Right-rail panel that shows preview thumbnails of the active slide
 * rendered in different visual styles (variants). Click a thumb to apply.
 *
 * Each layout has its own variant catalog. When a layout has no
 * meaningful variants (e.g. references), the panel renders nothing.
 */

type Variant = {
  id: string;
  label: string;
  /** Returns a cloned slide with the variant fields applied. */
  apply: (slide: Slide) => Slide;
  /** Reads the current variant id from the slide so we can highlight the active one. */
  current: (slide: Slide) => string;
};

const TITLE_VARIANTS: Variant[] = [
  { id: "image-cover",     label: "Image · Left",      apply: (s) => ({ ...s, titleVariant: "image-cover" }),     current: (s) => s.titleVariant || "centered" },
  { id: "image-center",    label: "Image · Center",    apply: (s) => ({ ...s, titleVariant: "image-center" }),    current: (s) => s.titleVariant || "centered" },
  { id: "image-editorial", label: "Image · Editorial", apply: (s) => ({ ...s, titleVariant: "image-editorial" }), current: (s) => s.titleVariant || "centered" },
  { id: "concept-hero", label: "Concept", apply: (s) => ({ ...s, titleVariant: "concept-hero" }), current: (s) => s.titleVariant || "centered" },
  { id: "centered",    label: "Centered",    apply: (s) => ({ ...s, titleVariant: "centered"    }), current: (s) => s.titleVariant || "centered" },
  { id: "asymmetric",  label: "Asymmetric",  apply: (s) => ({ ...s, titleVariant: "asymmetric"  }), current: (s) => s.titleVariant || "centered" },
  { id: "big-initial", label: "Big initial", apply: (s) => ({ ...s, titleVariant: "big-initial" }), current: (s) => s.titleVariant || "centered" },
  { id: "numbered",    label: "Numbered",    apply: (s) => ({ ...s, titleVariant: "numbered"    }), current: (s) => s.titleVariant || "centered" },
  { id: "underlined",  label: "Underlined",  apply: (s) => ({ ...s, titleVariant: "underlined"  }), current: (s) => s.titleVariant || "centered" },
  { id: "editorial-serif", label: "Editorial", apply: (s) => ({ ...s, titleVariant: "editorial-serif" }), current: (s) => s.titleVariant || "centered" },
];

const BULLETS_VARIANTS: Variant[] = [
  { id: "concept-cards", label: "Concept", apply: (s) => ({ ...s, bulletsVariant: "concept-cards" }), current: (s) => s.bulletsVariant || "standard" },
  { id: "bands",      label: "Color bands",   apply: (s) => ({ ...s, bulletsVariant: "bands"      }), current: (s) => s.bulletsVariant || "standard" },
  { id: "chevron",    label: "Process arrows", apply: (s) => ({ ...s, bulletsVariant: "chevron"   }), current: (s) => s.bulletsVariant || "standard" },
  { id: "numbered-cards", label: "Number cards", apply: (s) => ({ ...s, bulletsVariant: "numbered-cards" }), current: (s) => s.bulletsVariant || "standard" },
  { id: "timeline",   label: "Timeline",   apply: (s) => ({ ...s, bulletsVariant: "timeline"   }), current: (s) => s.bulletsVariant || "standard" },
  { id: "standard",   label: "Standard",   apply: (s) => ({ ...s, bulletsVariant: "standard"   }), current: (s) => s.bulletsVariant || "standard" },
  { id: "numbered",   label: "Numbered",   apply: (s) => ({ ...s, bulletsVariant: "numbered"   }), current: (s) => s.bulletsVariant || "standard" },
  { id: "cards",      label: "Cards",      apply: (s) => ({ ...s, bulletsVariant: "cards"      }), current: (s) => s.bulletsVariant || "standard" },
  { id: "icon-check", label: "Checkmarks", apply: (s) => ({ ...s, bulletsVariant: "icon-check" }), current: (s) => s.bulletsVariant || "standard" },
  { id: "dashed",     label: "Dashes",     apply: (s) => ({ ...s, bulletsVariant: "dashed"     }), current: (s) => s.bulletsVariant || "standard" },
];

const TWOCOL_VARIANTS: Variant[] = [
  { id: "classic",  label: "Classic",  apply: (s) => ({ ...s, twoColumnVariant: "classic"  }), current: (s) => s.twoColumnVariant || "classic" },
  { id: "divider",  label: "Divider",  apply: (s) => ({ ...s, twoColumnVariant: "divider"  }), current: (s) => s.twoColumnVariant || "classic" },
  { id: "cards",    label: "Cards",    apply: (s) => ({ ...s, twoColumnVariant: "cards"    }), current: (s) => s.twoColumnVariant || "classic" },
  { id: "numbered", label: "Numbered", apply: (s) => ({ ...s, twoColumnVariant: "numbered" }), current: (s) => s.twoColumnVariant || "classic" },
  { id: "compare",  label: "Pros/Cons",apply: (s) => ({ ...s, twoColumnVariant: "compare"  }), current: (s) => s.twoColumnVariant || "classic" },
];

const TABLE_VARIANTS: Variant[] = [
  { id: "zebra",         label: "Zebra rows",   apply: (s) => ({ ...s, tableVariant: "zebra"         }), current: (s) => s.tableVariant || "zebra" },
  { id: "bordered",      label: "Bordered",     apply: (s) => ({ ...s, tableVariant: "bordered"      }), current: (s) => s.tableVariant || "zebra" },
  { id: "minimal",       label: "Minimal",      apply: (s) => ({ ...s, tableVariant: "minimal"       }), current: (s) => s.tableVariant || "zebra" },
  { id: "accent-header", label: "Solid header", apply: (s) => ({ ...s, tableVariant: "accent-header" }), current: (s) => s.tableVariant || "zebra" },
  { id: "compact",       label: "Compact",      apply: (s) => ({ ...s, tableVariant: "compact"       }), current: (s) => s.tableVariant || "zebra" },
];

const QUOTE_VARIANTS: Variant[] = [
  { id: "giant-mark", label: "Giant mark",  apply: (s) => ({ ...s, quoteVariant: "giant-mark" }), current: (s) => s.quoteVariant || "giant-mark" },
  { id: "centered",   label: "Centered",    apply: (s) => ({ ...s, quoteVariant: "centered"   }), current: (s) => s.quoteVariant || "giant-mark" },
  { id: "card",       label: "Card",        apply: (s) => ({ ...s, quoteVariant: "card"       }), current: (s) => s.quoteVariant || "giant-mark" },
  { id: "editorial",  label: "Editorial",   apply: (s) => ({ ...s, quoteVariant: "editorial"  }), current: (s) => s.quoteVariant || "giant-mark" },
  { id: "stacked",    label: "Stacked",     apply: (s) => ({ ...s, quoteVariant: "stacked"    }), current: (s) => s.quoteVariant || "giant-mark" },
];

const SECTION_VARIANTS: Variant[] = [
  { id: "panel",       label: "Solid panel",  apply: (s) => ({ ...s, sectionVariant: "panel"       }), current: (s) => s.sectionVariant || "panel" },
  { id: "split",       label: "Split",        apply: (s) => ({ ...s, sectionVariant: "split"       }), current: (s) => s.sectionVariant || "panel" },
  { id: "minimal",     label: "Minimal",      apply: (s) => ({ ...s, sectionVariant: "minimal"     }), current: (s) => s.sectionVariant || "panel" },
  { id: "chapter",     label: "Chapter no.",  apply: (s) => ({ ...s, sectionVariant: "chapter"     }), current: (s) => s.sectionVariant || "panel" },
  { id: "kicker-hero", label: "Kicker hero",  apply: (s) => ({ ...s, sectionVariant: "kicker-hero" }), current: (s) => s.sectionVariant || "panel" },
];

const CLOSING_VARIANTS: Variant[] = [
  { id: "image",     label: "Image",      apply: (s) => ({ ...s, closingVariant: "image"     }), current: (s) => s.closingVariant || "centered" },
  { id: "centered",  label: "Centered",   apply: (s) => ({ ...s, closingVariant: "centered"  }), current: (s) => s.closingVariant || "centered" },
  { id: "qa",        label: "Q&A",        apply: (s) => ({ ...s, closingVariant: "qa"        }), current: (s) => s.closingVariant || "centered" },
  { id: "contact",   label: "Contact",    apply: (s) => ({ ...s, closingVariant: "contact"   }), current: (s) => s.closingVariant || "centered" },
  { id: "cta",       label: "Call to act",apply: (s) => ({ ...s, closingVariant: "cta"       }), current: (s) => s.closingVariant || "centered" },
  { id: "signature", label: "Signature",  apply: (s) => ({ ...s, closingVariant: "signature" }), current: (s) => s.closingVariant || "centered" },
];

function variantsFor(layout: SlideLayout): Variant[] {
  switch (layout) {
    case "title-hero": return TITLE_VARIANTS;
    case "bullets":    return BULLETS_VARIANTS;
    case "two-column": return TWOCOL_VARIANTS;
    case "table":      return TABLE_VARIANTS;
    case "quote":      return QUOTE_VARIANTS;
    case "section":    return SECTION_VARIANTS;
    case "closing":    return CLOSING_VARIANTS;
    case "references": return [];
    default:           return [];
  }
}

export default function StyleVariants({
  slide, deck, theme, onApply,
}: {
  slide: Slide;
  deck: Deck;
  theme: Theme;
  onApply: (next: Slide) => void;
}) {
  const dia = (slide.uploadedImages || []).find((im) => im.kind === "diagram");
  const variants = useMemo<Variant[]>(() => variantsFor(slide.layout), [slide.layout]);

  if (dia) {
    return <DiagramVariants slide={slide} deck={deck} theme={theme} onApply={onApply} />;
  }
  if (variants.length === 0) return null;

  const activeId = variants[0].current(slide);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-white/50">
        <Wand2 size={12} /> Style variants
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-white/45">
        Same content, different look. Click any preview to swap the style.
      </p>

      <div className="flex flex-col gap-2">
        {variants.map((v) => {
          const previewSlide = v.apply(slide);
          const active = activeId === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onApply(previewSlide)}
              className={`group overflow-hidden rounded-lg border text-left transition ${
                active ? "border-white/60 ring-2 ring-white/25" : "border-white/10 hover:border-white/35"
              }`}
            >
              <div className="pointer-events-none">
                <SlideCanvas
                  slide={previewSlide}
                  theme={theme}
                  idx={0}
                  total={1}
                  deckTitle={deck.title}
                  graphicId={deck.graphic}
                  graphicAccent={deck.graphicAccent}
                  fontId={deck.fontId}
                />
              </div>
              <div className="flex items-center justify-between bg-black/30 px-2 py-1.5">
                <span className="text-[11px] text-white/85">{v.label}</span>
                {active && <span className="text-[10px] text-white/45">selected</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
