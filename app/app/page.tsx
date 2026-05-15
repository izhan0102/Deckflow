"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PromptStep from "@/components/PromptStep";
import ThemeStep from "@/components/ThemeStep";
import DeckPreview from "@/components/DeckPreview";
import { PRESET_THEMES, type Theme } from "@/lib/themes";
import type { Deck, ContentDensity } from "@/lib/types";
import { getCurrentUser, isLoggedIn, logout, onAuthStateChange, type AppUser } from "@/lib/auth";
import { trackEvent } from "@/lib/stats";
import { LogOut } from "lucide-react";

type Step = "prompt" | "theme" | "deck";

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
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, slideCount, audience, tone, theme, density, includeReferences }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generation failed");
      setDeck(data.deck);
      setStep("deck");
      trackEvent({
        kind: "deck_generated",
        topic: prompt.slice(0, 200),
        slides: data.deck?.slides?.length || 0,
        ts: Date.now(),
        uid: user?.uid,
      });
    } catch (e: any) {
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black px-4 py-10 sm:px-8">
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
        />
      )}

      {step === "theme" && (
        <ThemeStep
          theme={theme}
          setTheme={setTheme}
          onBack={() => setStep("prompt")}
          onGenerate={generate}
          loading={loading}
        />
      )}

      {step === "deck" && deck && (
        <DeckPreview deck={deck} setDeck={setDeck} theme={theme} onRestart={restart} />
      )}
    </main>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "prompt", label: "Prompt" },
    { id: "theme",  label: "Theme"  },
    { id: "deck",   label: "Deck"   },
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
