"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import { getIdToken } from "@/lib/auth";

/**
 * Pre-generation clarifying step.
 *
 * When the user hits Generate, the AI asks a handful of TAP-ONLY
 * questions tailored to their brief (first one is always about
 * visuals/charts). The AI decides how many to ask — as many as it needs
 * to remove ambiguity, capped server-side. The user answers question by
 * question with a smooth transition, then we hand the chosen directives
 * back so the generator can honor them exactly.
 *
 * Visual language is minimal monochrome to match the rest of the app:
 * no accent colors, just white/black surfaces and a thin progress rule.
 */

type Option = { label: string; value: string };
type Question = {
  id: string;
  question: string;
  hint?: string;
  multi: boolean;
  options: Option[];
};

export default function ClarifyDialog({
  open, prompt, audience, tone, slideCount, onClose, onComplete,
}: {
  open: boolean;
  prompt: string;
  audience?: string;
  tone?: string;
  slideCount?: number;
  onClose: () => void;
  /** Called with the assembled directive string (may be empty). */
  onComplete: (directives: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const myReq = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    setQuestions([]);
    setStep(0);
    setAnswers({});

    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch("/api/clarify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ prompt, audience, tone, slideCount }),
        });
        const data = await res.json().catch(() => ({}));
        if (myReq !== reqIdRef.current) return;
        if (!res.ok || !Array.isArray(data?.questions) || data.questions.length === 0) {
          throw new Error(data?.error || "Couldn't load questions");
        }
        setQuestions(data.questions);
      } catch (e: any) {
        if (myReq !== reqIdRef.current) return;
        setError(e?.message || "Couldn't load questions");
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
      }
    })();
  }, [open, prompt, audience, tone, slideCount]);

  if (!open) return null;

  const total = questions.length;
  const current = questions[step];

  const assembleDirectives = (final: Record<string, string[]>): string => {
    const parts: string[] = [];
    for (const q of questions) {
      const chosen = final[q.id] || [];
      if (chosen.length === 0) continue;
      parts.push(chosen.join("; "));
    }
    if (parts.length === 0) return "";
    return "User preferences for this deck (honor strictly):\n- " + parts.join("\n- ");
  };

  const choose = (q: Question, value: string) => {
    setAnswers((prev) => {
      const existing = prev[q.id] || [];
      let next: string[];
      if (q.multi) {
        next = existing.includes(value)
          ? existing.filter((v) => v !== value)
          : [...existing, value];
      } else {
        next = [value];
      }
      const updated = { ...prev, [q.id]: next };
      // Single-choice questions auto-advance after a short beat.
      if (!q.multi) {
        window.setTimeout(() => {
          if (step < total - 1) setStep((s) => Math.min(total - 1, s + 1));
          else onComplete(assembleDirectives(updated));
        }, 220);
      }
      return updated;
    });
  };

  const canContinue = current ? (answers[current.id]?.length || 0) > 0 : false;
  const isLast = step === total - 1;

  const next = () => {
    if (isLast) onComplete(assembleDirectives(answers));
    else setStep((s) => Math.min(total - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border"
        style={{ background: "var(--ezd-bg-elev)", borderColor: "var(--ezd-divider)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--ezd-divider)" }}
        >
          <span className="text-[13px] font-medium" style={{ color: "var(--ezd-fg-strong)" }}>
            A few quick questions
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/10"
            style={{ color: "var(--ezd-fg-muted)" }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Progress rule — thin segments, one per question */}
        {total > 0 && !loading && !error && (
          <div className="flex gap-1 px-5 pt-4">
            {questions.map((_, i) => (
              <span
                key={i}
                className="h-[3px] flex-1 rounded-full transition-all duration-500"
                style={{
                  background: i <= step ? "var(--ezd-fg-strong)" : "var(--ezd-divider)",
                }}
              />
            ))}
          </div>
        )}

        {/* Body */}
        <div className="min-h-[230px] px-5 py-6">
          {loading && (
            <div
              className="flex h-[190px] flex-col items-center justify-center gap-3"
              style={{ color: "var(--ezd-fg-muted)" }}
            >
              <Loader2 size={20} className="animate-spin" />
              <span className="text-[13px]">Reading your brief…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex h-[190px] flex-col items-center justify-center gap-4 text-center">
              <p className="max-w-xs text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>
                {error}
              </p>
              <button
                onClick={() => onComplete("")}
                className="rounded-xl px-4 py-2 text-sm font-medium"
                style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
              >
                Skip and generate
              </button>
            </div>
          )}

          {!loading && !error && current && (
            <div key={current.id} className="clarify-fade">
              <div
                className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em]"
                style={{ color: "var(--ezd-fg-quiet)" }}
              >
                {step + 1} of {total}
              </div>
              <h3
                className="text-[17px] font-semibold leading-snug"
                style={{ color: "var(--ezd-fg-strong)" }}
              >
                {current.question}
              </h3>
              {(current.hint || current.multi) && (
                <p className="mt-1 text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>
                  {current.multi ? "Pick any that apply" : current.hint}
                </p>
              )}

              <div className="mt-5 grid gap-2">
                {current.options.map((opt) => {
                  const selected = (answers[current.id] || []).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => choose(current, opt.value)}
                      className="group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition"
                      style={{
                        borderColor: selected ? "var(--ezd-fg-strong)" : "var(--ezd-divider)",
                        background: selected ? "var(--ezd-bg-hover)" : "transparent",
                        color: "var(--ezd-fg)",
                      }}
                    >
                      <span className="text-[14px] font-medium">{opt.label}</span>
                      <span
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border transition"
                        style={{
                          borderColor: selected ? "var(--ezd-fg-strong)" : "var(--ezd-divider)",
                          background: selected ? "var(--ezd-fg-strong)" : "transparent",
                          color: selected ? "var(--ezd-bg-elev)" : "transparent",
                        }}
                      >
                        <Check size={12} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {!loading && !error && current && (
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderTop: "1px solid var(--ezd-divider)" }}
          >
            <button
              onClick={back}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-25"
              style={{ color: "var(--ezd-fg-muted)" }}
            >
              <ArrowLeft size={13} /> Back
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onComplete(assembleDirectives(answers))}
                className="rounded-lg px-3 py-1.5 text-[12px] transition"
                style={{ color: "var(--ezd-fg-quiet)" }}
              >
                Skip rest
              </button>
              <button
                onClick={next}
                disabled={!canContinue}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35"
                style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
              >
                {isLast ? "Generate" : "Next"}
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .clarify-fade {
          animation: clarify-fade 300ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes clarify-fade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
