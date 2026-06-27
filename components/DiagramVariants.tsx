"use client";
import { useEffect, useRef, useState } from "react";
import type { Deck, Slide, UploadedImage } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import SlideCanvas from "./SlideCanvas";
import { getIdToken } from "@/lib/auth";
import {
  renderMermaidSized, mermaidType, DIAGRAM_TYPE_LABELS, DIAGRAM_VARIANT_CANDIDATES,
} from "@/lib/diagramRender";
import { Wand2, Loader2, RefreshCw } from "lucide-react";

type Rendered = { dataUrl: string; w: number; h: number };

/**
 * Style-variants panel for a DIAGRAM slide. Instead of layout styles, it shows
 * the SAME content rendered as other diagram TYPES (flowchart, mind map,
 * sequence, timeline…). The alternates are generated all at once (one AI call
 * per type, in parallel), cached on the element, then rendered client-side so
 * switching between types is instant.
 */
export default function DiagramVariants({
  slide, deck, theme, onApply,
}: {
  slide: Slide;
  deck: Deck;
  theme: Theme;
  onApply: (next: Slide) => void;
}) {
  const dia: UploadedImage | undefined = (slide.uploadedImages || []).find((im) => im.kind === "diagram");
  const currentType = dia?.diagramType || mermaidType(dia?.mermaid);

  const [rendered, setRendered] = useState<Record<string, Rendered>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [err, setErr] = useState("");
  const genFor = useRef<string | null>(null);

  const variants = dia?.diagramVariants;

  // Persist a generated variant list onto the diagram element (without changing
  // which type is currently shown).
  const persist = (list: { type: string; label: string; mermaid: string }[]) => {
    if (!dia) return;
    const imgs = (slide.uploadedImages || []).map((im) =>
      im.id === dia.id ? { ...im, diagramVariants: list } : im);
    onApply({ ...slide, uploadedImages: imgs });
  };

  const generate = async () => {
    if (!dia?.mermaid) return;
    setStatus("loading"); setErr("");
    try {
      const token = await getIdToken();
      const cands = DIAGRAM_VARIANT_CANDIDATES.filter((t) => t !== currentType).slice(0, 3);
      const base = `${slide.title || "Diagram"}\n\nRecreate the SAME content, steps and labels as the diagram below — keep the same concepts and order, just as a different diagram type.\n\nExisting diagram (Mermaid):\n${dia.mermaid}`;
      const results = await Promise.all(cands.map(async (type) => {
        try {
          const res = await fetch("/api/diagram", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ prompt: base, type }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.mermaid) return null;
          const r = await renderMermaidSized(data.mermaid as string, "black");
          if (!r) return null;
          return { type, label: DIAGRAM_TYPE_LABELS[type] || type, mermaid: data.mermaid as string };
        } catch { return null; }
      }));
      const ok = results.filter(Boolean) as { type: string; label: string; mermaid: string }[];
      const list = [
        { type: currentType, label: DIAGRAM_TYPE_LABELS[currentType] || currentType, mermaid: dia.mermaid },
        ...ok,
      ];
      persist(list);
      if (ok.length === 0) { setStatus("error"); setErr("Couldn't generate other types — try regenerating."); }
      else setStatus("idle");
    } catch {
      setStatus("error"); setErr("Couldn't generate other types.");
    }
  };

  // Render cached variants to images; auto-generate once if none exist yet.
  useEffect(() => {
    if (!dia) return;
    if (variants && variants.length) {
      let cancelled = false;
      (async () => {
        const map: Record<string, Rendered> = {};
        await Promise.all(variants.map(async (v) => {
          const r = await renderMermaidSized(v.mermaid, "black");
          if (r) map[v.type] = r;
        }));
        if (!cancelled) setRendered(map);
      })();
      return () => { cancelled = true; };
    }
    if (genFor.current !== dia.id) {
      genFor.current = dia.id;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia?.id, variants]);

  if (!dia) return null;

  const slideForVariant = (v: { type: string; mermaid: string }): Slide => {
    const r = rendered[v.type];
    const imgs = (slide.uploadedImages || []).map((im) =>
      im.id === dia.id
        ? {
            ...im,
            mermaid: v.mermaid,
            diagramType: v.type,
            dataUrl: r?.dataUrl || im.dataUrl,
            w: r?.w ?? im.w,
            h: r?.h ?? im.h,
            x: r ? (13.333 - r.w) / 2 : im.x,
            diagramVariants: variants,
          }
        : im);
    return { ...slide, uploadedImages: imgs };
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50">
          <Wand2 size={12} /> Diagram type
        </div>
        {variants && variants.length > 0 && status !== "loading" && (
          <button
            onClick={() => { genFor.current = null; setRendered({}); generate(); }}
            title="Regenerate the other diagram types"
            className="inline-flex items-center gap-1 text-[10.5px] text-white/45 transition hover:text-white"
          >
            <RefreshCw size={10} /> Regenerate
          </button>
        )}
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-white/45">
        Same content, different diagram type. Click one to switch.
      </p>

      {status === "loading" && (
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-[12px] text-white/60">
          <Loader2 size={13} className="animate-spin text-cyan-300" />
          Generating other diagram types…
        </div>
      )}

      {status === "error" && (
        <div className="mb-2 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-200/80">
          {err}{" "}
          <button onClick={() => { genFor.current = null; generate(); }} className="underline hover:text-amber-100">Retry</button>
        </div>
      )}

      {variants && variants.length > 0 && (
        <div className="flex flex-col gap-2">
          {variants.map((v) => {
            const active = currentType === v.type;
            const ready = !!rendered[v.type];
            return (
              <button
                key={v.type}
                onClick={() => ready && onApply(slideForVariant(v))}
                disabled={!ready}
                className={`group overflow-hidden rounded-lg border text-left transition ${
                  active ? "border-white/60 ring-2 ring-white/25" : "border-white/10 hover:border-white/35"
                } ${ready ? "" : "opacity-60"}`}
              >
                <div className="pointer-events-none">
                  {ready ? (
                    <SlideCanvas
                      slide={slideForVariant(v)}
                      theme={theme}
                      idx={0}
                      total={1}
                      deckTitle={deck.title}
                      graphicId={deck.graphic}
                      graphicAccent={deck.graphicAccent}
                      fontId={deck.fontId}
                    />
                  ) : (
                    <div className="grid aspect-video w-full place-items-center bg-black/30">
                      <Loader2 size={14} className="animate-spin text-white/40" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between bg-black/30 px-2 py-1.5">
                  <span className="text-[11px] text-white/85">{v.label}</span>
                  {active && <span className="text-[10px] text-white/45">selected</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
