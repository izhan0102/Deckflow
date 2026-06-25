"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowUp, Loader2, Presentation, FileText, Table, Brain, ArrowRight } from "lucide-react";
import { onAuthStateChange, getIdToken, type AppUser } from "@/lib/auth";
import { readExaiRemaining } from "@/lib/exaiClient";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  { icon: Presentation, label: "Make a presentation on climate change", q: "I want to make a presentation about climate change" },
  { icon: FileText, label: "Write a business report", q: "Help me write a business report" },
  { icon: Table, label: "Build a budget spreadsheet", q: "I need a monthly budget spreadsheet" },
  { icon: Brain, label: "Analyse a PDF", q: "How do I analyse a PDF document?" },
];

export default function ExAiChat() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => onAuthStateChange(setUser), []);
  useEffect(() => { if (user) readExaiRemaining(user.uid).then((s) => { setRemaining(s.remaining); setLimit(s.limit); }); }, [user]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, sending]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || sending) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    const history = msgs.slice(-12);
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setSending(true); setLimitHit(false);
    try {
      const token = await getIdToken();
      if (!token) { setMsgs((m) => [...m, { role: "assistant", content: "Please [sign in](/auth) to chat with EX-AI." }]); setSending(false); return; }
      const res = await fetch("/api/exai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: q, messages: history }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === "exai_limit") setLimitHit(true);
        setMsgs((m) => [...m, { role: "assistant", content: data?.error || "Something went wrong." }]);
      } else {
        setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
        if (typeof data.remaining === "number") setRemaining(data.remaining);
        if (typeof data.limit === "number") setLimit(data.limit);
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Network error — please try again." }]);
    } finally { setSending(false); }
  };

  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const grow = () => { const t = taRef.current; if (t) { t.style.height = "auto"; t.style.height = Math.min(180, t.scrollHeight) + "px"; } };

  const empty = msgs.length === 0;

  return (
    <div className="flex h-[100dvh] flex-col" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <style>{`@keyframes exaiBlink{0%,100%{opacity:0.25}50%{opacity:1}}`}</style>
      <style>{`@keyframes exaiBlink{0%,100%{opacity:0.25}50%{opacity:1}}`}</style>
      {/* header */}
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6" style={{ borderColor: "var(--ezd-divider)" }}>
        <button onClick={() => router.push("/app")} className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>
          <ArrowRight size={14} className="rotate-180" /> Dashboard
        </button>
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}><Sparkles size={15} /></span>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>EX-AI</div>
            <div className="text-[10.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>Claude Opus 4.7</div>
          </div>
        </div>
        <div className="text-[11px] tabular-nums" style={{ color: "var(--ezd-fg-quiet)" }}>
          {remaining != null && limit != null ? `${remaining}/${limit} today` : ""}
        </div>
      </header>

      {/* conversation */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {empty ? (
            <div className="flex flex-col items-center pt-10 text-center sm:pt-20">
              <span className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}><Sparkles size={26} /></span>
              <h1 className="mt-5 text-[26px] font-bold tracking-tight sm:text-[32px]" style={{ color: "var(--ezd-fg-strong)" }}>How can I help you create?</h1>
              <p className="mt-2 max-w-md text-[14px]" style={{ color: "var(--ezd-fg-muted)" }}>Ask EX-AI anything about making presentations, documents, spreadsheets, resumes, or analysing files — I&rsquo;ll guide you and take you straight there.</p>
              <div className="mt-8 grid w-full max-w-xl gap-2.5 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s.label} onClick={() => send(s.q)} className="flex items-center gap-3 rounded-2xl border p-3.5 text-left transition hover:-translate-y-0.5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}><s.icon size={17} /></span>
                    <span className="text-[13.5px]" style={{ color: "var(--ezd-fg-muted)" }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {msgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex items-start gap-3"}>
                  {m.role === "assistant" && <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}><Sparkles size={15} /></span>}
                  <div className={m.role === "user" ? "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed" : "min-w-0 flex-1 text-[14.5px] leading-relaxed"}
                    style={m.role === "user" ? { background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" } : { color: "var(--ezd-fg)" }}>
                    {m.role === "assistant" ? <ChatMd text={m.content} onNav={(href) => router.push(href)} /> : m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}><Sparkles size={15} /></span>
                  <div className="flex items-center gap-1.5 pt-2"><Dot /><Dot d={0.15} /><Dot d={0.3} /></div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

      {/* composer */}
      <div className="border-t px-4 py-3 sm:px-6" style={{ borderColor: "var(--ezd-divider)" }}>
        <div className="mx-auto w-full max-w-3xl">
          {limitHit && (
            <div className="mb-2 flex items-center justify-between rounded-xl border px-3 py-2 text-[12.5px]" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-muted)" }}>
              <span>You&rsquo;re out of EX-AI messages for today.</span>
              <button onClick={() => router.push("/checkout")} className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>Upgrade</button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border p-2" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
            <textarea ref={taRef} value={input} onChange={(e) => { setInput(e.target.value); grow(); }} onKeyDown={onKey} rows={1}
              placeholder="Ask EX-AI to make or explain anything…"
              className="max-h-[180px] min-h-[24px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[14.5px] outline-none" style={{ color: "var(--ezd-fg)" }} />
            <button onClick={() => send()} disabled={sending || !input.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition disabled:opacity-40" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
              {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={17} />}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>EX-AI · Claude Opus 4.7 · can make mistakes — verify important info</p>
        </div>
      </div>
    </div>
  );
}

function Dot({ d = 0 }: { d?: number }) {
  return <span style={{ width: 7, height: 7, borderRadius: 7, background: "var(--ezd-fg-quiet)", display: "inline-block", animation: `exaiBlink 1s ${d}s infinite` }} />;
}

/* Chat markdown: CTA buttons for internal links, plus bold/bullets/numbered/links. */
function ChatMd({ text, onNav }: { text: string; onNav: (href: string) => void }) {
  const lines = text.split(/\n/);
  const out: React.ReactNode[] = [];
  let ul: string[] = [];
  const flush = () => { if (ul.length) { out.push(<ul key={out.length} className="my-1.5 ml-4 list-disc space-y-1">{ul.map((li, j) => <li key={j}>{inline(li, onNav)}</li>)}</ul>); ul = []; } };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { flush(); continue; }
    const cta = l.match(/^\[([^\]]+)\]\((\/[^)]*)\)$/); // lone internal link → button
    if (cta) {
      flush();
      out.push(
        <button key={out.length} onClick={() => onNav(cta[2])} className="my-2 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
          {cta[1].replace(/\s*→\s*$/, "")} <ArrowRight size={15} />
        </button>,
      );
    } else if (/^#{1,6}\s/.test(l)) { flush(); out.push(<h4 key={out.length} className="mt-2.5 text-[15px] font-bold" style={{ color: "var(--ezd-fg-strong)" }}>{inline(l.replace(/^#{1,6}\s/, ""), onNav)}</h4>); }
    else if (/^[-*]\s/.test(l)) { ul.push(l.replace(/^[-*]\s/, "")); }
    else if (/^\d+\.\s/.test(l)) { flush(); out.push(<p key={out.length} className="my-1" style={{ paddingLeft: 4 }}>{inline(l, onNav)}</p>); }
    else { flush(); out.push(<p key={out.length} className="my-1.5">{inline(l, onNav)}</p>); }
  }
  flush();
  return <div>{out}</div>;
}

function inline(s: string, onNav: (href: string) => void): React.ReactNode {
  // split on **bold** and [link](url)
  const tokens = s.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return tokens.map((t, i) => {
    const b = t.match(/^\*\*([^*]+)\*\*$/);
    if (b) return <strong key={i} style={{ color: "var(--ezd-fg-strong)" }}>{b[1]}</strong>;
    const lk = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (lk) {
      const href = lk[2];
      const label = lk[1].replace(/\s*[-→]+>?\s*$/, "");
      if (href.startsWith("/")) {
        // Internal action → render as an inline pill button that navigates.
        return (
          <button key={i} onClick={() => onNav(href)} className="mx-0.5 my-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px] font-semibold align-middle transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            {label} <ArrowRight size={13} />
          </button>
        );
      }
      return <a key={i} href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2" style={{ color: "var(--ezd-fg-strong)" }}>{lk[1]}</a>;
    }
    return t;
  });
}
