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
      findings.push({
        slideIndex: index,
        message: "Missing speaker notes",
      });
    }

    // Too many bullets
    if (slide.bullets && slide.bullets.length > 6) {
      findings.push({
        slideIndex: index,
        message: `Contains ${slide.bullets.length} bullet points`,
      });
    }

    // Long body text
    if (slide.body && slide.body.length > 500) {
      findings.push({
        slideIndex: index,
        message: "Slide contains a large amount of text",
      });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-6 text-white">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Deck Health</h2>

          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1 text-sm"
          >
            Close
          </button>
        </div>

        <div className="mb-6 rounded-xl border border-white/10 p-4">
          <h3 className="font-medium">Speaker Notes Coverage</h3>

          <p className="mt-2 text-sm text-white/70">
            {slidesWithNotes} / {deck.slides.length} slides ({coverage}%)
          </p>
        </div>

        <div>
          <h3 className="mb-3 font-medium">Findings</h3>

          {findings.length === 0 ? (
            <p className="text-green-400">
              No major issues detected.
            </p>
          ) : (
            <div className="space-y-2">
              {findings.map((finding, idx) => (
                <button
                  key={idx}
                  onClick={() => onJumpToSlide(finding.slideIndex)}
                  className="block w-full rounded-xl border border-white/10 p-3 text-left hover:bg-white/5"
                >
                  <div className="font-medium">
                    Slide {finding.slideIndex + 1}
                  </div>

                  <div className="text-sm text-white/70">
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