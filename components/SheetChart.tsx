"use client";
import { type ChartSpec, expandRange } from "@/lib/sheet";

const PALETTE = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ef4444", "#06b6d4", "#facc15", "#ec4899", "#14b8a6", "#84cc16"];

function num(s: string | undefined): number { const n = Number(String(s ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; }

export default function SheetChart({ spec, evaluated }: { spec: ChartSpec; evaluated: Record<string, string> }) {
  const labels = expandRange(spec.labels).map((r) => evaluated[r] ?? "");
  const values = expandRange(spec.values).map((r) => num(evaluated[r]));
  const n = Math.min(labels.length, values.length);
  const L = labels.slice(0, n);
  const V = values.slice(0, n);

  const W = 560, H = 260, padL = 44, padR = 16, padT = 16, padB = 42;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const fg = "var(--ezd-fg-strong)", mut = "var(--ezd-fg-muted)", grid = "var(--ezd-divider)";

  const clip = (s: string, max = 8) => (s.length > max ? s.slice(0, max) + "…" : s);

  let body: React.ReactNode = null;

  if (spec.type === "pie") {
    const total = V.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const cx = W / 2, cy = H / 2 - 6, R = Math.min(plotH, plotW) / 2 - 6;
    let acc = 0;
    body = (
      <>
        {V.map((v, i) => {
          const frac = Math.max(0, v) / total;
          const a0 = acc * 2 * Math.PI - Math.PI / 2; acc += frac; const a1 = acc * 2 * Math.PI - Math.PI / 2;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
          const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
          if (frac <= 0) return null;
          return <path key={i} d={`M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`} fill={PALETTE[i % PALETTE.length]} opacity={0.9} />;
        })}
      </>
    );
  } else {
    const max = Math.max(...V, 0) || 1;
    const min = Math.min(...V, 0);
    const range = max - min || 1;
    const yOf = (v: number) => padT + plotH - ((v - min) / range) * plotH;
    const stepX = n > 0 ? plotW / n : plotW;
    body = (
      <>
        {/* baseline */}
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke={grid} />
        {spec.type === "line" ? (
          <polyline fill="none" stroke={PALETTE[0]} strokeWidth={2.5}
            points={V.map((v, i) => `${(padL + stepX * (i + 0.5)).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ")} />
        ) : (
          V.map((v, i) => {
            const bw = Math.max(6, stepX * 0.62);
            const x = padL + stepX * (i + 0.5) - bw / 2;
            const y = yOf(Math.max(v, 0));
            const h = Math.abs(yOf(v) - yOf(0));
            return <rect key={i} x={x.toFixed(1)} y={(v >= 0 ? y : yOf(0)).toFixed(1)} width={bw.toFixed(1)} height={Math.max(1, h).toFixed(1)} rx={2} fill={PALETTE[i % PALETTE.length]} opacity={0.9} />;
          })
        )}
        {/* x labels */}
        {L.map((lab, i) => (
          <text key={i} x={padL + stepX * (i + 0.5)} y={H - padB + 16} textAnchor="middle" fontSize={9} fill={mut as string}>{clip(String(lab))}</text>
        ))}
        {/* y max / min */}
        <text x={padL - 6} y={padT + 4} textAnchor="end" fontSize={9} fill={mut as string}>{Math.round(max)}</text>
        <text x={padL - 6} y={padT + plotH} textAnchor="end" fontSize={9} fill={mut as string}>{Math.round(min)}</text>
      </>
    );
  }

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
      {spec.title && <div className="mb-1 text-[13px] font-semibold" style={{ color: fg }}>{spec.title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 280 }} role="img" aria-label={spec.title || "chart"}>{body}</svg>
      {spec.type === "pie" && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {L.map((lab, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[11px]" style={{ color: mut }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: PALETTE[i % PALETTE.length], display: "inline-block" }} />{clip(String(lab), 14)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
