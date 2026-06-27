"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Download, Copy, Check, Code2, Wand2, Plus } from "lucide-react";
import { getIdToken } from "@/lib/auth";

type DiagramType = {
  id: string;
  label: string;
  template: string;
};

const TYPES: DiagramType[] = [
  { id: "flowchart", label: "Flowchart", template: `flowchart TD\n  A(["Start"]) --> B["Validate input"]\n  B --> C{"Valid?"}\n  C -->|Yes| D["Process"]\n  C -->|No| E["Show error"]\n  D --> F(["Done"])\n  E --> F` },
  { id: "timeline", label: "Timeline", template: `timeline\n  title Product Roadmap\n  2023 : Kickoff : Research\n  2024 : Beta launch\n  2025 : GA release` },
  { id: "mindmap", label: "Mind Map", template: `mindmap\n  root((AI))\n    NLP\n      Chatbots\n      Translation\n    Vision\n      Detection\n    Robotics` },
  { id: "architecture", label: "Architecture", template: `flowchart TD\n  Browser["Browser / UI"] --> API["API layer"]\n  API --> Auth["Auth service"]\n  API --> DB[("Database")]\n  API --> Cache[("Cache")]` },
  { id: "er", label: "ER Diagram", template: `erDiagram\n  USER ||--o{ ORDER : places\n  USER {\n    string id PK\n    string name\n  }\n  ORDER {\n    string order_id PK\n    string user_id FK\n  }` },
  { id: "network", label: "Network", template: `flowchart TD\n  Router["Router"] --> Switch["Switch"]\n  Switch --> PC["PC"]\n  Switch --> Printer["Printer"]\n  Switch --> AP["Wi-Fi AP"]` },
  { id: "orgchart", label: "Org Chart", template: `flowchart TD\n  CEO["CEO"] --> CTO["CTO"]\n  CEO --> CFO["CFO"]\n  CEO --> COO["COO"]\n  CTO --> Eng["Engineering"]` },
  { id: "decision", label: "Decision Tree", template: `flowchart TD\n  Q{"Is it urgent?"} -->|Yes| A["Handle now"]\n  Q -->|No| B{"Important?"}\n  B -->|Yes| C["Schedule it"]\n  B -->|No| D["Drop it"]` },
  { id: "sequence", label: "Sequence", template: `sequenceDiagram\n  participant Client\n  participant Server\n  participant DB\n  Client->>Server: Request\n  Server->>DB: Query\n  DB-->>Server: Result\n  Server-->>Client: Response` },
];

let RENDER_SEQ = 0;

export default function DiagramStudio({ onInsert, onInsertNewSlide, initialPrompt, initialCode, mode = "insert" }: {
  onInsert?: (svg: string, code: string) => void;
  onInsertNewSlide?: (svg: string, code: string) => void;
  initialPrompt?: string;
  initialCode?: string;
  mode?: "insert" | "replace";
} = {}) {
  const [type, setType] = useState<string>("flowchart");
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [code, setCode] = useState<string>(initialCode || TYPES[0].template);
  const [svg, setSvg] = useState<string>("");
  const [renderErr, setRenderErr] = useState<string | null>(null);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [textColor, setTextColor] = useState<"black" | "white">("black");
  const previewRef = useRef<HTMLDivElement>(null);

  // Render the current Mermaid source to SVG (debounced).
  const render = useCallback(async (src: string) => {
    if (!src.trim()) { setSvg(""); setRenderErr(null); return; }
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default", htmlLabels: false, flowchart: { htmlLabels: false } });
      const id = `dgm-${++RENDER_SEQ}`;
      let { svg: out } = await mermaid.render(id, src);
      // Force EVERY text/line/arrow (incl. text inside node boxes) to the chosen
      // colour so the diagram is readable on light (black) or dark (white) slides.
      const M = textColor === "white" ? "#ffffff" : "#000000";
      const F = textColor === "white" ? "rgba(255,255,255,0.08)" : "#ffffff";
      const css = `<style>text,tspan,.nodeLabel,.edgeLabel,.label,.titleText,.messageText,.loopText,.noteText,foreignObject div,foreignObject span,foreignObject p{fill:${M} !important;color:${M} !important}.edgePath path,.flowchart-link,line,.messageLine0,.messageLine1,path.relation,.actor-line,.divider{stroke:${M} !important}marker path,marker polygon{fill:${M} !important;stroke:${M} !important}.node rect,.node circle,.node polygon,.node ellipse,.node path,.cluster rect,rect.actor,.actor,.note,.labelBox{fill:${F} !important;stroke:${M} !important}.edgeLabel rect,.label-container{fill:transparent !important}</style>`;
      out = out.replace(/(<svg[^>]*>)/, `$1${css}`);
      setSvg(out);
      setRenderErr(null);
    } catch (e: any) {
      // Keep the last good SVG; surface a short syntax hint.
      setRenderErr(String(e?.message || e || "Invalid diagram syntax.").split("\n")[0].slice(0, 200));
    }
  }, [textColor]);

  useEffect(() => {
    const t = setTimeout(() => { void render(code); }, 250);
    return () => clearTimeout(t);
  }, [code, render]);

  const pickType = (id: string) => {
    setType(id);
    const tpl = TYPES.find((t) => t.id === id)?.template || "";
    setCode(tpl);
    setGenErr(null);
  };

  // Validate Mermaid source via mermaid.parse — returns an error string or null.
  const validate = async (src: string): Promise<string | null> => {
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default" });
      await mermaid.parse(src);
      return null;
    } catch (e: any) {
      return String(e?.message || e || "parse error").split("\n").slice(0, 3).join(" ").slice(0, 300);
    }
  };

  const callDiagram = async (token: string, payload: Record<string, unknown>) => {
    const res = await fetch("/api/diagram", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { mermaid: data?.mermaid as string | undefined, error: data?.error as string | undefined, ok: res.ok };
  };

  const generate = async () => {
    if (!prompt.trim() || generating) return;
    setGenErr(null);
    setGenerating(true);
    try {
      const token = await getIdToken();
      if (!token) { setGenErr("Please sign in to generate diagrams."); return; }
      const first = await callDiagram(token, { prompt: prompt.trim(), type });
      if (!first.ok || !first.mermaid) { setGenErr(first.error || "Generation failed."); return; }
      let out = first.mermaid;
      // Self-heal: if the generated diagram won't parse, ask the API to fix it once.
      const verr = await validate(out);
      if (verr) {
        const fixed = await callDiagram(token, { type, fix: out, error: verr });
        if (fixed.ok && fixed.mermaid && !(await validate(fixed.mermaid))) out = fixed.mermaid;
      }
      setCode(out);
    } catch {
      setGenErr("Network error — please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadSvg = () => {
    if (!svg) return;
    triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `diagram-${type}.svg`);
  };

  const downloadPng = async () => {
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error("render failed"));
        im.src = url;
      });
      const scale = 2;
      const w = (img.naturalWidth || img.width || 800);
      const h = (img.naturalHeight || img.height || 600);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => { if (b) triggerDownload(b, `diagram-${type}.png`); }, "image/png");
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  };

  const copyMermaid = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Preview */}
      <div className="order-1 lg:order-none">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--ezd-divider)" }}>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => pickType(t.id)}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-medium transition"
                style={type === t.id
                  ? { background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }
                  : { background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-muted)" }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="mr-1 flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: "var(--ezd-divider)" }} title="Diagram color — pick white for dark slide backgrounds">
              <button onClick={() => setTextColor("black")} aria-label="Black" title="Black — for light backgrounds" className="grid h-6 w-6 place-items-center rounded-md" style={{ background: textColor === "black" ? "var(--ezd-bg-hover)" : "transparent", outline: textColor === "black" ? "2px solid var(--ezd-fg-strong)" : "none" }}>
                <span style={{ width: 14, height: 14, borderRadius: 999, background: "#111111", border: "1px solid rgba(0,0,0,0.3)", display: "block" }} />
              </button>
              <button onClick={() => setTextColor("white")} aria-label="White" title="White — for dark backgrounds" className="grid h-6 w-6 place-items-center rounded-md" style={{ background: textColor === "white" ? "var(--ezd-bg-hover)" : "transparent", outline: textColor === "white" ? "2px solid var(--ezd-fg-strong)" : "none" }}>
                <span style={{ width: 14, height: 14, borderRadius: 999, background: "#ffffff", border: "1px solid rgba(0,0,0,0.3)", display: "block" }} />
              </button>
            </div>
            {onInsert && (
              <button onClick={() => { if (svg) onInsert(svg, code); }} disabled={!svg} title={mode === "replace" ? "Replace this diagram" : "Insert into the current slide"} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
                <Plus size={13} /> {mode === "replace" ? "Replace" : "Insert"}
              </button>
            )}
            {onInsertNewSlide && mode !== "replace" && (
              <button onClick={() => { if (svg) onInsertNewSlide(svg, code); }} disabled={!svg} title="Insert as a new slide" className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium disabled:opacity-40" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>
                <Plus size={13} /> New slide
              </button>
            )}
            <button onClick={copyMermaid} title="Copy Mermaid source" className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>
              {copied ? <Check size={13} /> : <Copy size={13} />} Mermaid
            </button>
            <button onClick={downloadSvg} disabled={!svg} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium disabled:opacity-40" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>
              <Download size={13} /> SVG
            </button>
            <button onClick={downloadPng} disabled={!svg} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium disabled:opacity-40" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>
              <Download size={13} /> PNG
            </button>
          </div>
        </div>

        <div
          ref={previewRef}
          className="mt-3 grid min-h-[380px] place-items-center overflow-auto rounded-2xl border p-4"
          style={{ borderColor: "var(--ezd-divider)", background: textColor === "white" ? "#15151a" : "#ffffff" }}
          // Mermaid output is sanitized SVG produced locally from the user's own source.
          dangerouslySetInnerHTML={{ __html: svg || "" }}
        />
        {renderErr && (
          <p className="mt-2 text-[12.5px]" style={{ color: "#ef4444" }}>Syntax: {renderErr}</p>
        )}
      </div>

      {/* Controls */}
      <div className="order-2 flex flex-col gap-4 lg:order-none">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ezd-fg-quiet)" }}>
            <Sparkles size={13} /> Generate with AI
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(); } }}
            rows={4}
            placeholder={`Describe the ${TYPES.find((t) => t.id === type)?.label.toLowerCase()} — e.g. "user authentication flow with JWT"`}
            className="mt-2.5 w-full resize-none rounded-xl border bg-transparent p-3 text-[13.5px] outline-none"
            style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg)" }}
          />
          <button
            onClick={generate}
            disabled={generating || !prompt.trim()}
            className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
          >
            {generating ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
            {generating ? "Generating…" : "Generate diagram"}
          </button>
          {genErr && <p className="mt-2 text-[12px]" style={{ color: "#ef4444" }}>{genErr}</p>}
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border p-4" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ezd-fg-quiet)" }}>
            <Code2 size={13} /> Edit (Mermaid)
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="mt-2.5 min-h-[220px] w-full flex-1 resize-none rounded-xl border bg-transparent p-3 font-mono text-[12.5px] leading-relaxed outline-none"
            style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg)" }}
          />
          <p className="mt-2 text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>Edit the source — the preview updates live. It&rsquo;s a real vector diagram, not an image.</p>
        </div>
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
