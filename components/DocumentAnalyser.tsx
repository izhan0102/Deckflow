"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, FileText, X, Loader2, Sparkles, Brain, Layers, ArrowRight, Send, MessageCircle } from "lucide-react";
import { extractFileText, type ExtractProgress } from "@/lib/extractText";
import { onAuthStateChange, getIdToken, type AppUser } from "@/lib/auth";

type Depth = "overview" | "moderate" | "deep";
type Doc = { id: string; name: string; size: number; text: string; status: "extracting" | "ready" | "error"; note?: string };

const DEPTHS: { id: Depth; label: string; sub: string }[] = [
  { id: "overview", label: "Overview", sub: "Quick gist" },
  { id: "moderate", label: "Moderate", sub: "Balanced" },
  { id: "deep", label: "Deep", sub: "Thorough" },
];
const FOCI = [
  { id: "auto", label: "Auto (smart)" },
  { id: "summary", label: "Summary" },
  { id: "insights", label: "Key insights" },
  { id: "risks", label: "Risks & gaps" },
  { id: "actions", label: "Action items" },
  { id: "data", label: "Data & numbers" },
  { id: "code", label: "Code review" },
];

const rid = () => Math.random().toString(36).slice(2, 9);

export default function DocumentAnalyser() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [depth, setDepth] = useState<Depth>("moderate");
  const [focus, setFocus] = useState("auto");
  const [analysing, setAnalysing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ perDoc: { title: string; type: string; analysis: string }[]; synthesis: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Follow-up chat (with memory)
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, asking]);

  useEffect(() => onAuthStateChange(setUser), []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setErr(null);
    const list = Array.from(files).slice(0, 8 - docs.length);
    for (const file of list) {
      const id = rid();
      setDocs((d) => [...d, { id, name: file.name, size: file.size, text: "", status: "extracting" }]);
      try {
        const text = await extractFileText(file, (_p: ExtractProgress) => {});
        setDocs((d) => d.map((x) => x.id === id ? { ...x, text, status: text.trim() ? "ready" : "error", note: text.trim() ? `${text.length.toLocaleString()} chars` : "No readable text" } : x));
      } catch {
        setDocs((d) => d.map((x) => x.id === id ? { ...x, status: "error", note: "Couldn't read this file" } : x));
      }
    }
  }, [docs.length]);

  const removeDoc = (id: string) => setDocs((d) => d.filter((x) => x.id !== id));
  const ready = docs.filter((d) => d.status === "ready");

  const analyse = async () => {
    if (analysing) return;
    if (ready.length === 0) { setErr("Add at least one readable document."); return; }
    setAnalysing(true); setErr(null); setResult(null); setChat([]);
    try {
      const token = await getIdToken();
      if (!token) { setErr("Please sign in to analyse documents."); setAnalysing(false); return; }
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ depth, focus, docs: ready.map((d) => ({ name: d.name, text: d.text })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Analysis failed.");
      setResult(data);
    } catch (e: any) { setErr(e?.message || "Analysis failed."); } finally { setAnalysing(false); }
  };

  const askQuestion = async () => {
    const q = ask.trim();
    if (!q || asking) return;
    setAsk("");
    const history = chat.slice(-10);
    setChat((c) => [...c, { role: "user", content: q }]);
    setAsking(true);
    try {
      const token = await getIdToken();
      if (!token) { setChat((c) => [...c, { role: "assistant", content: "Please sign in to continue." }]); setAsking(false); return; }
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: q, messages: history, docs: ready.map((d) => ({ name: d.name, text: d.text })) }),
      });
      const data = await res.json();
      setChat((c) => [...c, { role: "assistant", content: res.ok ? (data.answer || "…") : (data?.error || "Couldn't answer that.") }]);
    } catch {
      setChat((c) => [...c, { role: "assistant", content: "Something went wrong — try again." }]);
    } finally { setAsking(false); }
  };

  return (
    <div>
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition"
        style={{ borderColor: drag ? "var(--ezd-fg-strong)" : "var(--ezd-divider)", background: drag ? "var(--ezd-bg-hover)" : "var(--ezd-bg-card)" }}
      >
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
        <UploadCloud size={28} style={{ margin: "0 auto", color: "var(--ezd-fg-muted)" }} />
        <p className="mt-3 text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Drop documents here, or click to upload</p>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>PDF · Word · Excel · PowerPoint · txt · csv · json · code · images — up to 8 files, read privately on your device</p>
      </div>

      {/* File chips */}
      {docs.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {docs.map((d, i) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}>
                {d.status === "extracting" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium" style={{ color: "var(--ezd-fg-strong)" }}>Doc {i + 1} · {d.name}</span>
                <span className="block text-[11px]" style={{ color: d.status === "error" ? "#ef4444" : "var(--ezd-fg-quiet)" }}>{d.status === "extracting" ? "Reading…" : d.note}</span>
              </span>
              <button onClick={() => removeDoc(d.id)} style={{ color: "var(--ezd-fg-quiet)" }}><X size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Options */}
      <div className="mt-5 flex flex-wrap items-end gap-5">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--ezd-fg-quiet)" }}>Analysis strength</div>
          <div className="flex gap-1.5">
            {DEPTHS.map((d) => {
              const on = depth === d.id;
              return (
                <button key={d.id} onClick={() => setDepth(d.id)} className="rounded-xl border px-3.5 py-2 text-left transition" style={{ borderColor: on ? "var(--ezd-fg-strong)" : "var(--ezd-divider)", background: on ? "var(--ezd-bg-hover)" : "transparent" }}>
                  <span className="block text-[13px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{d.label}</span>
                  <span className="block text-[10.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>{d.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--ezd-fg-quiet)" }}>Focus</div>
          <select value={focus} onChange={(e) => setFocus(e.target.value)} className="rounded-xl border px-3 py-2.5 text-[13px]" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}>
            {FOCI.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <button onClick={analyse} disabled={analysing || ready.length === 0}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
          {analysing ? <><Loader2 size={16} className="animate-spin" /> Analysing…</> : <><Brain size={16} /> Analyse {ready.length > 1 ? `${ready.length} docs` : "document"}</>}
        </button>
      </div>

      {err && <p className="mt-3 text-[13px]" style={{ color: "#ef4444" }}>{err}{err.includes("sign in") && <> · <a href="/auth" className="underline">Sign in</a></>}</p>}

      {/* Results */}
      {result && (
        <div className="mt-8 space-y-5">
          {result.synthesis && result.perDoc.length > 1 && (
            <div className="rounded-2xl border p-5" style={{ borderColor: "var(--ezd-fg-strong)", background: "var(--ezd-bg-card)" }}>
              <div className="mb-2 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--ezd-fg-strong)" }}><Layers size={14} /> Cross-document synthesis</div>
              <Md text={result.synthesis} />
            </div>
          )}
          {result.perDoc.map((p, i) => (
            <div key={i} className="rounded-2xl border p-5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
              <div className="mb-1 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-[11px] font-bold" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>{i + 1}</span>
                <span className="text-[15px] font-bold" style={{ color: "var(--ezd-fg-strong)" }}>{p.title}</span>
                {p.type && <span className="rounded-full px-2 py-0.5 text-[10.5px]" style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-muted)" }}>{p.type}</span>}
              </div>
              <Md text={p.analysis} />
            </div>
          ))}

          {/* Follow-up chat with memory */}
          <div className="rounded-2xl border p-5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
            <div className="mb-3 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--ezd-fg-strong)" }}><MessageCircle size={14} /> Ask about {ready.length > 1 ? "these documents" : "this document"}</div>
            {chat.length > 0 && (
              <div className="mb-3 space-y-2.5">
                {chat.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed"
                      style={m.role === "user"
                        ? { background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }
                        : { background: "var(--ezd-bg-hover)", color: "var(--ezd-fg)" }}>
                      {m.role === "assistant" ? <Md text={m.content} /> : m.content}
                    </div>
                  </div>
                ))}
                {asking && <div className="flex justify-start"><div className="rounded-2xl px-3.5 py-2" style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-muted)" }}><Loader2 size={14} className="animate-spin" /></div></div>}
                <div ref={chatEndRef} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") askQuestion(); }}
                placeholder="e.g. What are the main risks? How do these two compare?"
                className="min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 text-[13.5px]" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }} />
              <button onClick={askQuestion} disabled={asking || !ask.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
                {asking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            <p className="mt-2 text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>Remembers the conversation, so you can ask follow-ups.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* Tiny markdown renderer: ## headings, - bullets, **bold**, paragraphs. */
function Md({ text }: { text: string }) {
  const lines = text.split(/\n/);
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) { out.push(<ul key={out.length} className="my-2 ml-4 list-disc space-y-1">{list.map((li, j) => <li key={j} className="text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{inline(li)}</li>)}</ul>); list = []; }
  };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { flush(); continue; }
    if (/^#{1,6}\s/.test(l)) { flush(); out.push(<h4 key={out.length} className="mt-3 text-[14px] font-bold" style={{ color: "var(--ezd-fg-strong)" }}>{inline(l.replace(/^#{1,6}\s/, ""))}</h4>); }
    else if (/^[-*]\s/.test(l)) { list.push(l.replace(/^[-*]\s/, "")); }
    else { flush(); out.push(<p key={out.length} className="my-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{inline(l)}</p>); }
  }
  flush();
  return <div>{out}</div>;
}

function inline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i} style={{ color: "var(--ezd-fg-strong)" }}>{p.slice(2, -2)}</strong> : p);
}
