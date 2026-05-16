"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PromptStep from "@/components/PromptStep";
import ThemeStep from "@/components/ThemeStep";
import FontStep from "@/components/FontStep";
import GraphicStep from "@/components/GraphicStep";
import DeckPreview from "@/components/DeckPreview";
import GenerateOverlay from "@/components/GenerateOverlay";
import TemplateGallery from "@/components/TemplateGallery";
import { PRESET_THEMES, getTheme, type Theme } from "@/lib/themes";
import type { Deck, ContentDensity } from "@/lib/types";
import { applyTemplateToSlide, type TemplateVariantDefaults } from "@/lib/templates";
import { getCurrentUser, isLoggedIn, logout, onAuthStateChange, type AppUser } from "@/lib/auth";
import { trackEvent } from "@/lib/stats";
import { LogOut } from "lucide-react";

type Step = "prompt" | "theme" | "font" | "graphic" | "deck";

export default function Page() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);

  // Gate: must be logged in. Otherwise bounce to /auth.
  // Use onAuthStateChange so a freshly-restored Firebase session isn't
  // mistaken for "logged out" during the first render.
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChange((u) => {
      if (cancelled) return;
      if (!u) {
        router.replace("/auth?redirect=/app");
        return;
      }
      setUser(u);
      setAuthReady(true);
      trackEvent({ kind: "page_view", path: "/app", ts: Date.now(), uid: u.uid });
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [router]);

  const [step, setStep] = useState<Step>("prompt");
  const [prompt, setPrompt] = useState("");
  const [slideCount, setSlideCount] = useState(8);
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [density, setDensity] = useState<ContentDensity>("balanced");
  const [includeReferences, setIncludeReferences] = useState(true);
  const [theme, setTheme] = useState<Theme>(PRESET_THEMES[0]);
  const [graphicId, setGraphicId] = useState<string>("none");
  const [graphicAccent, setGraphicAccent] = useState<string | undefined>(undefined);
  const [fontId, setFontId] = useState<string>("inter");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // When a template is picked, we keep its variant defaults so we can apply
  // them to every slide once generation finishes.
  const [templateVariants, setTemplateVariants] = useState<TemplateVariantDefaults | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    // Minimum animation time of 10s so the overlay always feels intentional.
    const minDelay = new Promise<void>((r) => window.setTimeout(r, 10000));
    try {
      const fetchPromise = fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, slideCount, audience, tone, theme, density, includeReferences }),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Generation failed");
        return data;
      });

      const [data] = await Promise.all([fetchPromise, minDelay]);
      const slides = (templateVariants
        ? data.deck.slides.map((s: any) => applyTemplateToSlide(s, templateVariants))
        : data.deck.slides);
      const deckWithExtras: Deck = { ...data.deck, slides, graphic: graphicId, graphicAccent, fontId };
      setDeck(deckWithExtras);
      setStep("deck");
      if (user) {
        trackEvent({
          kind: "deck_generated",
          topic: prompt.slice(0, 200),
          slides: deckWithExtras?.slides?.length || 0,
          ts: Date.now(),
          uid: user.uid,
        });
      }
    } catch (e: any) {
      // Even on failure, let the animation finish so the UX isn't jarring.
      await minDelay.catch(() => {});
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    setStep("prompt");
    setDeck(null);
  };

  if (!authReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-black text-white/60 text-sm">
        Loading…
      </main>
    );
  }

  const isDeckStep = step === "deck";

  return (
    <main
      className={`min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black ${
        isDeckStep ? "px-4 py-6 sm:px-8" : "px-4 py-10 sm:px-8"
      }`}
    >
      {!isDeckStep && (
        <header className="mx-auto mb-12 flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center">
            <span className="border-b-2 border-white pb-0.5 font-semibold tracking-tight">
              DeckFlow
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Stepper step={step} />
            {user && (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
                <span className="text-white/70">{user.name || user.email}</span>
                <button
                  onClick={async () => { await logout(); router.replace("/"); }}
                  title="Sign out"
                  className="text-white/50 hover:text-white/90"
                >
                  <LogOut size={12} />
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      {error && (
        <div className="mx-auto mb-6 max-w-3xl rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {step === "prompt" && (
        <PromptStep
          prompt={prompt}
          setPrompt={setPrompt}
          slideCount={slideCount}
          setSlideCount={setSlideCount}
          audience={audience}
          setAudience={setAudience}
          tone={tone}
          setTone={setTone}
          density={density}
          setDensity={setDensity}
          includeReferences={includeReferences}
          setIncludeReferences={setIncludeReferences}
          onNext={() => setStep("theme")}
          onUseTemplate={() => setGalleryOpen(true)}
          activeTemplateName={templateName || undefined}
          onGenerateDirect={generate}
          generateLoading={loading}
        />
      )}

      {step === "theme" && (
        <ThemeStep
          theme={theme}
          setTheme={setTheme}
          onBack={() => setStep("prompt")}
          onGenerate={() => setStep("font")}
          loading={false}
        />
      )}

      {step === "font" && (
        <FontStep
          theme={theme}
          fontId={fontId}
          setFontId={setFontId}
          onBack={() => setStep("theme")}
          onNext={() => setStep("graphic")}
        />
      )}

      {step === "graphic" && (
        <GraphicStep
          theme={theme}
          graphicId={graphicId}
          setGraphicId={setGraphicId}
          graphicAccent={graphicAccent}
          setGraphicAccent={setGraphicAccent}
          onBack={() => setStep("font")}
          onGenerate={generate}
          loading={loading}
        />
      )}

      {step === "deck" && deck && (
        <DeckPreview deck={deck} setDeck={setDeck} theme={theme} onRestart={restart} />
      )}

      {/* Full-screen "deck is being prepared" overlay. Mounts as soon as
          loading flips on (i.e. when the user clicks Generate on the
          GraphicStep) and unmounts after both the API call and a 10s
          minimum animation finish. */}
      <GenerateOverlay open={loading} />

      <TemplateGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onPick={(t) => {
          const picked = getTheme(t.themeId);
          if (picked) setTheme(picked);
          setFontId(t.fontId);
          setGraphicId(t.graphicId);
          setGraphicAccent(t.graphicAccent);
          if (t.density) setDensity(t.density);
          if (typeof t.includeReferences === "boolean") setIncludeReferences(t.includeReferences);
          // Seed the prompt only when empty so we don't trample what the user
          // has already typed.
          if (!prompt.trim()) setPrompt(t.samplePrompt);
          setTemplateVariants(t.variants);
          setTemplateName(t.name);
        }}
      />
    </main>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "prompt",   label: "Prompt"   },
    { id: "theme",    label: "Theme"    },
    { id: "font",     label: "Font"     },
    { id: "graphic",  label: "Graphic"  },
    { id: "deck",     label: "Deck"     },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div className="hidden items-center gap-3 sm:flex">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3">
          <div
            className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
              i <= idx ? "bg-white text-black" : "bg-white/10 text-white/60"
            }`}
          >
            {i + 1}
          </div>
          <span className={i <= idx ? "text-white" : "text-white/50"}>{s.label}</span>
          {i < steps.length - 1 && <span className="text-white/30">→</span>}
        </div>
      ))}
    </div>
  );
}
