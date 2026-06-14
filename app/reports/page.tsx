"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { watchReports, type IssueReport } from "@/lib/reports";

/**
 * /reports — read-only list of submitted issue reports.
 * Shows ONLY the username and the report text (plus when it was sent).
 * No email, uid, or any other user data is displayed or stored.
 */
export default function ReportsPage() {
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = watchReports((items) => {
      setReports(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-500/15 text-red-500">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Issue reports</h1>
            <p className="text-xs" style={{ color: "var(--ezd-fg-quiet)" }}>Username and report only — no other data.</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm" style={{ color: "var(--ezd-fg-muted)" }}>
            <Loader2 size={16} className="animate-spin" /> Loading reports…
          </div>
        ) : reports.length === 0 ? (
          <div className="mt-10 rounded-2xl border p-8 text-center text-sm"
               style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-quiet)" }}>
            No reports yet.
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {reports.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border p-4"
                style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{r.username}</span>
                  {r.createdAt > 0 && (
                    <span className="text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm" style={{ color: "var(--ezd-fg-muted)" }}>
                  {r.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
