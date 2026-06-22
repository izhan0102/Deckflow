import type { Deck } from "@/lib/types";

type Props = {
  deck: Deck;
  onClose: () => void;
  onJumpToSlide: (index: number) => void;
};

type Finding = {
  slideIndex: number;
  message: string;
};

export default function DeckHealthAnalyzer({
  deck,
  onClose,
  onJumpToSlide,
}: Props) {
  const findings: Finding[] = [];

  deck.slides.forEach((slide, index) => {
    // Missing speaker notes
    if (!slide.notes || slide.notes.trim().length === 0) {
      findings.push({ slideIndex: index, message: "Missing speaker notes" });
    }
    // Too many bullets
    if (slide.bullets && slide.bullets.length > 6) {
      findings.push({ slideIndex: index, message: `Contains ${slide.bullets.length} bullet points` });
    }
    // Long body text
    if (slide.body && slide.body.length > 500) {
      findings.push({ slideIndex: index, message: "Slide contains a large amount of text" });
    }
  });

  const slidesWithNotes = deck.slides.filter(
    (slide) => slide.notes && slide.notes.trim().length > 0
  ).length;

  const coverage =
    deck.slides.length > 0
      ? Math.round((slidesWithNotes / deck.slides.length) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border p-6"
        style={{ background: "var(--ezd-bg-elev)", color: "var(--ezd-fg)", borderColor: "var(--ezd-divider)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Deck Health</h2>
          <button
            onClick={onClose}
            className="rounded-lg border px-3 py-1 text-sm transition hover:opacity-80"
            style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}
          >
            Close
          </button>
        </div>

        <div className="mb-6 rounded-xl border p-4" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <h3 className="font-medium" style={{ color: "var(--ezd-fg-strong)" }}>Speaker Notes Coverage</h3>
          <p className="mt-2 text-sm" style={{ color: "var(--ezd-fg-muted)" }}>
            {slidesWithNotes} / {deck.slides.length} slides ({coverage}%)
          </p>
        </div>

        <div>
          <h3 className="mb-3 font-medium" style={{ color: "var(--ezd-fg-strong)" }}>Findings</h3>
          {findings.length === 0 ? (
            <p style={{ color: "#22c55e" }}>No major issues detected.</p>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {findings.map((finding, idx) => (
                <button
                  key={idx}
                  onClick={() => onJumpToSlide(finding.slideIndex)}
                  className="block w-full rounded-xl border p-3 text-left transition hover:opacity-80"
                  style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
                >
                  <div className="font-medium" style={{ color: "var(--ezd-fg-strong)" }}>
                    Slide {finding.slideIndex + 1}
                  </div>
                  <div className="text-sm" style={{ color: "var(--ezd-fg-muted)" }}>
                    {finding.message}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
