"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, X, Settings2, Captions, Volume2, Maximize2, Minimize2, Loader2 } from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import type { Deck } from "@/lib/types";
import type { Theme } from "@/lib/themes";

/**
 * Autopilot Present — hands-free narrated presentation.
 *
 * Uses the browser's Web Speech API, but surfaces and defaults to the natural
 * / neural voices modern systems ship (Microsoft "… (Natural)", Google, etc.)
 * — instant, free, no API/keys, and far more human than the legacy robotic
 * voice. Narration is chunked by sentence so auto-advance fires reliably
 * (works around Chrome's long-utterance cutoff), with a keep-alive resume.
 *
 * Fixed DARK overlay in every theme → inline colors (globals.css remaps
 * text-white/bg-white in light mode).
 */

const TONES_HINT = ""; // (Web Speech has no direction tags)

// Inline color tokens.
const TX = "#ffffff";
const TX2 = "rgba(255,255,255,0.62)";
const TX3 = "rgba(255,255,255,0.40)";
const SURF = "rgba(255,255,255,0.06)";
const SURF_ON = "rgba(255,255,255,0.16)";
const BRD = "rgba(255,255,255,0.12)";
const BRD_ON = "rgba(255,255,255,0.40)";

function stripHtml(s: string): string {
  if (!s) return "";
  if (typeof document === "undefined") return s.replace(/<[^>]+>/g, " ");
  const el = document.createElement("div");
  el.innerHTML = s;
  return (el.textContent || el.innerText || "").replace(/\s+/g, " ").trim();
}

/** Rank voices so the most human-like surface first / default. */
function scoreVoice(v: SpeechSynthesisVoice): number {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  let s = 0;
  if (/natural|neural/.test(n)) s += 120;
  if (/google/.test(n)) s += 70;
  if (/premium|enhanced|siri/.test(n)) s += 50;
  if (/online/.test(n)) s += 35;
  if (/\b(aria|jenny|guy|ryan|sonia|libby|natasha|emma|michelle|ava|samantha|eric|brian)\b/.test(n)) s += 28;
  if (v.lang?.toLowerCase().startsWith("en")) s += 20;
  if (v.lang?.toLowerCase() === "en-us") s += 5;
  return s;
}

/** Tidy a voice's display name. */
function niceName(v: SpeechSynthesisVoice): string {
  return v.name.replace(/^Microsoft\s+/i, "").replace(/\s+Online\s*\(Natural\)/i, " (Natural)").replace(/\s*-\s*English.*$/i, "");
}

/** Split into short sentence chunks so onend fires reliably. */
function chunkText(t: string): string[] {
  const parts = t.match(/[^.!?]+[.!?]*\s*/g) || [t];
  const chunks: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > 220) { if (cur.trim()) chunks.push(cur.trim()); cur = p; }
    else cur += p;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [t];
}

export default function AutoPresent({
  deck, theme, startIndex = 0, onClose,
}: {
  deck: Deck;
  theme: Theme;
  startIndex?: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [playing, setPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [idle, setIdle] = useState(false);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const playingRef = useRef(false);
  const idxRef = useRef(idx); idxRef.current = idx;
  const seqRef = useRef(0);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = deck.slides.length;
  const scriptFor = useCallback((i: number) => {
    const s = deck.slides[i];
    return stripHtml(s?.notes || "") || stripHtml(s?.title || "") || "";
  }, [deck]);

  /* ---- load voices + restore prefs ---- */
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) { setUnsupported(true); return; }
    const load = () => {
      const all = synth.getVoices();
      const en = all.filter((v) => v.lang?.toLowerCase().startsWith("en"));
      const list = (en.length ? en : all).slice().sort((a, b) => scoreVoice(b) - scoreVoice(a));
      setVoices(list);
      setVoiceURI((cur) => {
        if (cur && list.some((v) => v.voiceURI === cur)) return cur;
        try { const saved = localStorage.getItem("exdeck:voice"); if (saved && list.some((v) => v.voiceURI === saved)) return saved; } catch { /* ignore */ }
        const zira = list.find((v) => /zira/i.test(v.name));
        return zira?.voiceURI || list[0]?.voiceURI || "";
      });
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
    try {
      const r = parseFloat(localStorage.getItem("exdeck:rate") || "1"); if (isFinite(r)) setRate(r);
      const p = parseFloat(localStorage.getItem("exdeck:pitch") || "1"); if (isFinite(p)) setPitch(p);
    } catch { /* ignore */ }
    return () => { synth.removeEventListener?.("voiceschanged", load); synth.cancel(); };
  }, []);

  useEffect(() => { try { if (voiceURI) localStorage.setItem("exdeck:voice", voiceURI); } catch { /* ignore */ } }, [voiceURI]);
  useEffect(() => { try { localStorage.setItem("exdeck:rate", String(rate)); } catch { /* ignore */ } }, [rate]);
  useEffect(() => { try { localStorage.setItem("exdeck:pitch", String(pitch)); } catch { /* ignore */ } }, [pitch]);

  const voiceObj = voices.find((v) => v.voiceURI === voiceURI);

  /* ---- keep-alive: Chrome pauses synthesis after ~15s; nudge it. ---- */
  const startKeepAlive = () => {
    stopKeepAlive();
    keepAliveRef.current = setInterval(() => {
      const s = window.speechSynthesis;
      if (s.speaking && playingRef.current) { try { s.pause(); s.resume(); } catch { /* ignore */ } }
    }, 9000);
  };
  const stopKeepAlive = () => { if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; } };

  /* ---- narrate a slide (sentence chunks) ---- */
  const speak = useCallback((i: number) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const seq = ++seqRef.current;
    synth.cancel();
    const text = scriptFor(i);
    if (!text) {
      if (i < total - 1) window.setTimeout(() => { if (playingRef.current && seqRef.current === seq) setIdx(i + 1); }, 1100);
      else { playingRef.current = false; setPlaying(false); }
      return;
    }
    const chunks = chunkText(text);
    let k = 0;
    const next = () => {
      if (seqRef.current !== seq || !playingRef.current) return;
      if (k >= chunks.length) {
        if (idxRef.current < total - 1) setIdx(idxRef.current + 1);
        else { playingRef.current = false; setPlaying(false); stopKeepAlive(); }
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[k]);
      if (voiceObj) u.voice = voiceObj;
      u.rate = rate; u.pitch = pitch; u.lang = voiceObj?.lang || "en-US";
      u.onend = () => { if (seqRef.current !== seq) return; k++; next(); };
      u.onerror = () => { if (seqRef.current !== seq) return; k++; next(); };
      synth.speak(u);
    };
    startKeepAlive();
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptFor, voiceObj, rate, pitch, total]);
  useEffect(() => {
    if (playing) speak(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, playing]);
  useEffect(() => {
    if (playingRef.current) speak(idxRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceURI, rate, pitch]);

  const play = () => { playingRef.current = true; setPlaying(true); };
  const pause = () => { playingRef.current = false; setPlaying(false); seqRef.current++; window.speechSynthesis?.cancel(); stopKeepAlive(); };
  const toggle = () => (playing ? pause() : play());
  const go = (n: number) => { const v = Math.max(0, Math.min(total - 1, n)); seqRef.current++; window.speechSynthesis?.cancel(); setIdx(v); };

  // Stop all narration before unmounting so nothing keeps talking after exit.
  const handleClose = () => {
    playingRef.current = false;
    seqRef.current++;
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    stopKeepAlive();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    onClose();
  };

  const preview = (uri: string) => {
    const synth = window.speechSynthesis; if (!synth) return;
    const v = voices.find((x) => x.voiceURI === uri); if (!v) return;
    seqRef.current++; playingRef.current = false; setPlaying(false); synth.cancel();
    setPreviewing(uri);
    const u = new SpeechSynthesisUtterance(`Hi, I'm ${niceName(v)}. I'll narrate your deck.`);
    u.voice = v; u.rate = rate; u.pitch = pitch; u.lang = v.lang;
    u.onend = () => setPreviewing(null);
    u.onerror = () => setPreviewing(null);
    synth.speak(u);
  };

  // Fullscreen
  const toggleFullscreen = () => {
    const el = rootRef.current; if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Auto-hide chrome in immersive mode; reveal on mouse move.
  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 2600);
  }, []);
  const onMove = useCallback(() => {
    setIdle(false);
    if (document.fullscreenElement) armIdle();
  }, [armIdle]);
  useEffect(() => {
    if (fullscreen) armIdle();
    else { setIdle(false); if (idleTimer.current) clearTimeout(idleTimer.current); }
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [fullscreen, armIdle]);

  useEffect(() => () => { window.speechSynthesis?.cancel(); stopKeepAlive(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      else if (e.key === " ") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowRight") go(idxRef.current + 1);
      else if (e.key === "ArrowLeft") go(idxRef.current - 1);
      else if (e.key.toLowerCase() === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slide = deck.slides[idx];
  const enriched = slide?.layout === "references" ? { ...slide, references: deck.references || [] } : slide;
  const caption = scriptFor(idx);
  const immersive = fullscreen;
  const showChrome = !immersive || !idle;

  return (
    <div ref={rootRef} onMouseMove={onMove} className="fixed inset-0 z-[2147483000] flex flex-col overflow-hidden" style={{ background: immersive ? "#000" : "radial-gradient(120% 120% at 50% 0%, #0e1018 0%, #05060a 60%)", color: TX, cursor: immersive && idle ? "none" : "auto" }}>
      <style>{`@keyframes apSlideIn{from{opacity:0;transform:translateY(10px) scale(0.99)}to{opacity:1;transform:none}}`}</style>

      <div
        className={immersive ? "absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3 sm:px-6 transition-opacity duration-300" : "flex items-center justify-between px-4 py-3 sm:px-6"}
        style={immersive ? { opacity: showChrome ? 1 : 0, pointerEvents: showChrome ? "auto" : "none", background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)" } : undefined}
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold tracking-wide" style={{ background: SURF_ON, color: TX }}><Volume2 size={13} /> Autopilot</span>
          <span className="text-[12px] tabular-nums" style={{ color: TX3 }}>{String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {!immersive && <Pill active={showCaptions} onClick={() => setShowCaptions((s) => !s)} title="Captions"><Captions size={16} /></Pill>}
          {!immersive && <Pill active={showSettings} onClick={() => setShowSettings((s) => !s)} title="Voice"><Settings2 size={16} /></Pill>}
          <Pill onClick={toggleFullscreen} title="Fullscreen (F)">{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</Pill>
          <Pill onClick={handleClose} title="Exit (Esc)"><X size={16} /></Pill>
        </div>
      </div>

      {/* progress (windowed only) */}
      {!immersive && (
      <div className="px-4 sm:px-6">
        <div className="mx-auto h-[3px] max-w-[1100px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${((idx + 1) / total) * 100}%`, background: "rgba(255,255,255,0.7)" }} />
        </div>
      </div>
      )}

      <div className="relative flex flex-1 min-h-0 items-center justify-center" style={{ padding: immersive ? 0 : "12px 16px" }}>
        <div key={idx} className="w-full overflow-hidden shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]" style={{ border: immersive ? "none" : `1px solid ${BRD}`, borderRadius: immersive ? 0 : 16, maxWidth: immersive ? "min(100vw, calc(100vh * 1.7778))" : "min(1080px, calc((100vh - 250px) * 1.7778))", animation: "apSlideIn .35s ease both" }}>
          {enriched && (
            <SlideCanvas slide={enriched} theme={theme} idx={idx} total={total} deckTitle={deck.title} graphicId={deck.graphic} graphicAccent={deck.graphicAccent} fontId={deck.fontId} />
          )}
        </div>

        {showSettings && !immersive && (
          <div className="absolute right-4 top-2 max-h-[80vh] w-[330px] overflow-y-auto rounded-2xl p-4 shadow-2xl backdrop-blur" style={{ border: `1px solid ${BRD}`, background: "rgba(12,14,21,0.96)", color: TX }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: TX3 }}>Voice</div>
            {unsupported ? (
              <p className="mt-2 text-[12px]" style={{ color: TX2 }}>Speech isn't supported in this browser.</p>
            ) : voices.length === 0 ? (
              <p className="mt-2 text-[12px]" style={{ color: TX2 }}>Loading voices…</p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-1.5">
                {voices.map((v) => {
                  const on = v.voiceURI === voiceURI;
                  const natural = scoreVoice(v) >= 100;
                  return (
                    <div key={v.voiceURI} className="flex items-center justify-between rounded-xl px-3 py-2 transition" style={{ border: `1px solid ${on ? BRD_ON : BRD}`, background: on ? SURF_ON : SURF }}>
                      <button onClick={() => setVoiceURI(v.voiceURI)} className="flex flex-1 items-center gap-2 overflow-hidden text-left">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold" style={{ background: on ? "#fff" : SURF_ON, color: on ? "#000" : TX }}>{niceName(v)[0]}</span>
                        <span className="truncate text-[12.5px] font-medium" style={{ color: TX }}>{niceName(v)}{natural ? " ★" : ""}</span>
                        <span className="ml-auto shrink-0 text-[10px]" style={{ color: TX3 }}>{v.lang}</span>
                      </button>
                      <button onClick={() => preview(v.voiceURI)} title="Preview" className="ml-2 grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ border: `1px solid ${BRD}`, background: SURF, color: TX }}>
                        {previewing === v.voiceURI ? <Loader2 size={13} className="animate-spin" /> : <Play size={12} className="translate-x-px" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-[12px]" style={{ color: TX2 }}><span>Speed</span><span className="tabular-nums" style={{ color: TX3 }}>{rate.toFixed(2)}×</span></div>
            <input type="range" min={0.6} max={1.5} step={0.05} value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} className="mt-1 w-full" style={{ accentColor: "#fff" }} />
            <div className="mt-3 flex items-center justify-between text-[12px]" style={{ color: TX2 }}><span>Tone (pitch)</span><span className="tabular-nums" style={{ color: TX3 }}>{pitch.toFixed(2)}</span></div>
            <input type="range" min={0.6} max={1.5} step={0.05} value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))} className="mt-1 w-full" style={{ accentColor: "#fff" }} />
            <p className="mt-3 text-[11px] leading-relaxed" style={{ color: TX3 }}>★ = natural/neural voices (best quality). Available voices depend on your OS/browser.{TONES_HINT}</p>
          </div>
        )}
      </div>

      {showCaptions && !immersive && (
        <div className="mx-auto w-full max-w-[1080px] px-6">
          <div className="rounded-xl px-4 py-3 text-center text-[14px] leading-relaxed" style={{ border: `1px solid ${BRD}`, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.9)", minHeight: 56 }}>
            {caption || <span style={{ color: TX3 }}>Press play — the deck narrates itself.</span>}
          </div>
        </div>
      )}

      <div
        className={immersive ? "absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-4 px-4 py-6 transition-opacity duration-300" : "flex items-center justify-center gap-4 px-4 py-5"}
        style={immersive ? { opacity: showChrome ? 1 : 0, pointerEvents: showChrome ? "auto" : "none", background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)" } : undefined}
      >
        <Pill onClick={() => go(idx - 1)} title="Previous (←)" disabled={idx === 0}><SkipBack size={18} /></Pill>
        <button onClick={toggle} className="grid h-16 w-16 place-items-center rounded-full shadow-lg transition hover:scale-105" style={{ background: "#fff", color: "#000" }} title="Play / pause (Space)">
          {playing ? <Pause size={24} /> : <Play size={24} className="translate-x-0.5" />}
        </button>
        <Pill onClick={() => go(idx + 1)} title="Next (→)" disabled={idx === total - 1}><SkipForward size={18} /></Pill>
      </div>
    </div>
  );
}

function Pill({ children, onClick, title, active, disabled }: { children: React.ReactNode; onClick: () => void; title?: string; active?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className="grid h-10 w-10 place-items-center rounded-full transition disabled:opacity-30"
      style={{ border: `1px solid ${active ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.12)"}`, background: active ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.06)", color: "#fff" }}>
      {children}
    </button>
  );
}
