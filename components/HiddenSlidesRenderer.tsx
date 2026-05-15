"use client";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { Deck } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import SlideCanvas from "./SlideCanvas";

export type HiddenSlidesHandle = { getNodes: () => HTMLElement[] };

/**
 * Renders every slide of a deck off-screen at a known size so we can
 * snapshot them with html2canvas for PDF export. Each slide is wrapped in
 * a fixed 1280x720 box (16:9) so the export quality is consistent.
 */
const HiddenSlidesRenderer = forwardRef<HiddenSlidesHandle, { deck: Deck; theme: Theme }>(
  function HiddenSlidesRenderer({ deck, theme }, ref) {
    const wrapRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      getNodes() {
        if (!wrapRef.current) return [];
        return Array.from(wrapRef.current.querySelectorAll<HTMLElement>("[data-slide-node]"));
      },
    }), []);

    return (
      <div
        ref={wrapRef}
        aria-hidden
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          width: 1280,
          pointerEvents: "none",
          opacity: 1,
        }}
      >
        {deck.slides.map((s, i) => {
          const slide = s.layout === "references" ? { ...s, references: deck.references || [] } : s;
          return (
            <div
              key={i}
              data-slide-node
              style={{ width: 1280, marginBottom: 16 }}
            >
              <SlideCanvas
                slide={slide}
                theme={theme}
                idx={i}
                total={deck.slides.length}
                deckTitle={deck.title}
              />
            </div>
          );
        })}
      </div>
    );
  },
);

export default HiddenSlidesRenderer;
