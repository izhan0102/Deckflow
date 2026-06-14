"use client";
import { useEffect, useState } from "react";
import { BarChart3, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { Theme } from "@/lib/themes";
import { type ChartSpec, type ChartType, chartDataUri } from "@/lib/charts";

const TYPES: { id: ChartType; label: string }[] = [
  { id: "bar", label: "Bar" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
  { id: "pie", label: "Pie" },
  { id: "donut", label: "Donut" },
];

type Editing = { id: string; spec: ChartSpec } | null;

type Quality = NonNullable<ChartSpec["dataQuality"]>;

const QUALITY_LABEL: Record<Quality, string> = {
  actual: "Real data",
  projected: "Projected",
  estimated: "Estimated",
  mixed: "Mixed",
};
const QUALITY_HINT: Record<Quality, string> = {
  actual: "Figures the AI recalls as real from its training (verify before publishing).",
  projected: "Recent/future points are projected from the real historical trend.",
  estimated: "Illustrative placeholder values — replace with your real data.",
  mixed: "Some points are real, some projected.",
};
const QUALITY_STYLE: Record<Quality, React.CSSProperties> = {
  actual:    { borderColor: "rgba(52,211,153,0.4)", background: "rgba(52,211,153,0.12)", color: "#a7f3d0" },
  projected: { borderColor: "rgba(34,211,238,0.4)", background: "rgba(34,211,238,0.12)", color: "#a5f3fc" },
  estimated: { borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.12)", color: "#fde68a" },
  mixed:     { borderColor: "rgba(34,211,238,0.4)", background: "rgba(34,211,238,0.12)", color: "#a5f3fc" },
};

/**
 * Add-visuals modal. Describe a topic/data (or pick a type), generate a chart
 * with the AI, preview it as every chart type, fine-tune the data and colors,
 * then insert it on the current slide, add it as a new slide, or drag it onto
 * the canvas. Reused for editing an existing chart element (editing != null).
 */
export default function VisualsDrawer({
  open, onClose, theme, editing, getToken,
  onInsertCurrent, onInsertNewSlide, onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  editing?: Editing;
  getToken: () => Promise<string | null>;
  onInsertCurrent: (spec: ChartSpec) => void;
  onInsertNewSlide: (spec: ChartSpec) => void;
  onUpdate: (id: string, spec: ChartSpec) => void;
}) {
  const [description, setDescription] = useState("");
  const [wantType, setWantType] = useState<ChartType | "auto">("auto");
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [spec, setSpec] = useState<ChartSpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When opened to edit an existing chart, load it but keep the describe /
  // manual controls available so the user can also replace it outright.
  useEffect(() => {
    if (!open) return;
    if (editing?.spec) { setSpec(editing.spec); setMode("ai"); setDescription(""); setError(null); }
    else { setSpec(null); setDescription(""); setWantType("auto"); setMode("ai"); setError(null); }
  }, [open, editing]);

  if (!open) return null;

  const startManual = () => {
    setMode("manual");
    setError(null);
    setSpec((prev) => prev || {
      type: "bar",
      title: "Untitled chart",
      unit: "",
      data: [
        { label: "Category A", value: 30 },
        { label: "Category B", value: 50 },
        { label: "Category C", value: 20 },
      ],
    });
  };

  const generate = async () => {
    if (description.trim().length < 2) { setError("Describe the data or topic first."); return; }
    setLoading(true); setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ description: description.trim(), type: wantType === "auto" ? undefined : wantType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.spec) throw new Error(data?.error || "Couldn't build a chart. Try rephrasing.");
      setSpec(data.spec as ChartSpec);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const setType = (t: ChartType) => spec && setSpec({ ...spec, type: t });
  const editDatum = (i: number, patch: Partial<{ label: string; value: number; color?: string }>) => {
    if (!spec) return;
    const data = spec.data.map((d, j) => (j === i ? { ...d, ...patch } : d));
    setSpec({ ...spec, data });
  };
  const addRow = () => spec && spec.data.length < 8 && setSpec({ ...spec, data: [...spec.data, { label: "New", value: 0 }] });
  const removeRow = (i: number) => spec && spec.data.length > 2 && setSpec({ ...spec, data: spec.data.filter((_, j) => j !== i) });

  const isEditing = !!editing;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-white">
            <BarChart3 size={16} className="text-cyan-300" /> {isEditing ? "Edit chart" : "Add a visual"}
          </span>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-white/55 hover:bg-white/10 hover:text-white"><X size={15} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Mode toggle — replace this chart with AI or build it by hand. */}
          <div className="mb-4 inline-flex rounded-xl border border-white/12 bg-black/30 p-1">
            <button
              onClick={() => setMode("ai")}
              className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition ${mode === "ai" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
            >{isEditing ? "Replace with AI" : "Describe with AI"}</button>
            <button
              onClick={startManual}
              className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition ${mode === "manual" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
            >Enter data manually</button>
          </div>

          {/* Describe step (AI mode) */}
          {mode === "ai" && (
            <div className="mb-5">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Describe the data or topic</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. global fertility rate over the last 6 decades · our revenue split by product · market share of top EV makers"
                rows={2}
                className="w-full resize-none rounded-xl border border-white/12 bg-black/40 p-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/40"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-white/45">Type:</span>
                <button
                  onClick={() => setWantType("auto")}
                  className={`rounded-full border px-3 py-1 text-[12px] transition ${wantType === "auto" ? "border-cyan-300/50 bg-cyan-300/10 text-white" : "border-white/12 bg-white/[0.03] text-white/65 hover:text-white"}`}
                >Let AI choose</button>
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setWantType(t.id)}
                    className={`rounded-full border px-3 py-1 text-[12px] transition ${wantType === t.id ? "border-cyan-300/50 bg-cyan-300/10 text-white" : "border-white/12 bg-white/[0.03] text-white/65 hover:text-white"}`}
                  >{t.label}</button>
                ))}
                <button
                  onClick={generate}
                  disabled={loading}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {spec ? "Regenerate" : "Generate"}
                </button>
              </div>
              {error && <p className="mt-2 text-[12px] text-red-300">{error}</p>}
            </div>
          )}

          {/* Preview + editor */}
          {spec && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
              {/* Live preview (draggable) */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Preview · drag onto the slide</span>
                  {spec.dataQuality && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em]"
                      style={QUALITY_STYLE[spec.dataQuality]}
                      title={QUALITY_HINT[spec.dataQuality]}
                    >
                      {QUALITY_LABEL[spec.dataQuality]}
                    </span>
                  )}
                </div>
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-exdeck-chart", JSON.stringify(spec));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="grid cursor-grab place-items-center rounded-xl border border-white/12 p-3 active:cursor-grabbing"
                  style={{ background: theme.bg }}
                  title="Drag me onto a slide"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={chartDataUri(spec, theme)} alt="chart preview" draggable={false} style={{ width: "100%", maxHeight: 240, objectFit: "contain" }} />
                </div>

                {/* All chart types */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {TYPES.map((t) => {
                    const active = spec.type === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setType(t.id)}
                        className={`overflow-hidden rounded-lg border transition ${active ? "border-cyan-300/60" : "border-white/12 hover:border-white/30"}`}
                        style={{ width: 84, background: theme.bg }}
                        title={t.label}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={chartDataUri({ ...spec, type: t.id }, theme)} alt={t.label} style={{ width: "100%", height: 52, objectFit: "contain" }} />
                        <div className={`py-0.5 text-center text-[10px] ${active ? "text-cyan-200" : "text-white/55"}`}>{t.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Data editor */}
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">Source / basis (shown on the chart)</label>
                  <input
                    value={spec.note || ""}
                    onChange={(e) => setSpec({ ...spec, note: e.target.value })}
                    placeholder="e.g. World Bank · through 2021"
                    className="w-full rounded-lg border border-white/12 bg-black/40 px-2.5 py-1.5 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">Title</label>
                    <input value={spec.title || ""} onChange={(e) => setSpec({ ...spec, title: e.target.value })} className="w-full rounded-lg border border-white/12 bg-black/40 px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-cyan-300/40" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">Unit</label>
                    <input value={spec.unit || ""} onChange={(e) => setSpec({ ...spec, unit: e.target.value })} placeholder="% · M · k" className="w-full rounded-lg border border-white/12 bg-black/40 px-2.5 py-1.5 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">Data</label>
                  <div className="space-y-1.5">
                    {spec.data.map((d, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(d.color || "") ? d.color : "#888888"} onChange={(e) => editDatum(i, { color: e.target.value })} className="h-7 w-7 shrink-0 cursor-pointer rounded border border-white/12 bg-transparent p-0" title="Series color" />
                        <input value={d.label} onChange={(e) => editDatum(i, { label: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/40 px-2 py-1 text-[12px] text-white outline-none focus:border-cyan-300/40" />
                        <input type="number" value={d.value} onChange={(e) => editDatum(i, { value: Number(e.target.value) })} className="w-16 rounded-lg border border-white/12 bg-black/40 px-2 py-1 text-[12px] text-white outline-none focus:border-cyan-300/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                        <button onClick={() => removeRow(i)} disabled={spec.data.length <= 2} className="grid h-6 w-6 shrink-0 place-items-center rounded text-white/40 hover:bg-white/10 hover:text-red-300 disabled:opacity-30"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addRow} disabled={spec.data.length >= 8} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-white/75 hover:bg-white/10 disabled:opacity-40"><Plus size={12} /> Add row</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {spec && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-5 py-3.5">
            {isEditing ? (
              <button
                onClick={() => { if (editing) onUpdate(editing.id, spec); onClose(); }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-white/90"
              >Save changes</button>
            ) : (
              <>
                <button
                  onClick={() => { onInsertNewSlide(spec); onClose(); }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-white/10"
                >Add as new slide</button>
                <button
                  onClick={() => { onInsertCurrent(spec); onClose(); }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-white/90"
                >Insert on this slide</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
