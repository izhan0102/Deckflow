"use client";
import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { submitReport } from "@/lib/reports";

/**
 * Lightweight "Report an issue" modal. Asks only for the report text;
 * the username is passed in by the caller and stored alongside it.
 * Nothing else about the user is captured.
 */
export default function ReportDialog({
  open, onClose, username,
}: {
  open: boolean;
  onClose: () => void;
  username: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    if (busy) return;
    setText(""); setDone(false); setError(null);
    onClose();
  };

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      await submitReport(username, text);
      setDone(true);
      setText("");
    } catch (e: any) {
      setError(e?.message || "Couldn't send your report. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-5 shadow-2xl"
        style={{ background: "var(--ezd-bg-elev)", borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/15 text-red-500">
              <AlertTriangle size={16} />
            </span>
            <h2 className="text-base font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Report an issue</h2>
          </div>
          <button onClick={close} className="rounded-md p-1 hover:opacity-100" style={{ color: "var(--ezd-fg-quiet)" }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-500">
            Thanks — your report was sent. We&apos;ll take a look.
            <div className="mt-3">
              <button
                onClick={close}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 text-xs" style={{ color: "var(--ezd-fg-quiet)" }}>
              Tell us what went wrong. Only your username and this message are stored.
            </p>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Describe the bug or issue you ran into…"
              className="mt-3 w-full resize-none rounded-xl border p-3 text-sm focus:border-red-400/60 focus:outline-none"
              style={{ background: "var(--ezd-bg-card)", borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-strong)" }}
            />
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>{text.length}/2000</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={close}
                  className="rounded-lg px-3 py-2 text-xs font-medium"
                  style={{ color: "var(--ezd-fg-muted)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={send}
                  disabled={!text.trim() || busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  Send report
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
