"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PromptStep from "@/components/PromptStep";
import ThemeStep from "@/components/ThemeStep";
import FontStep from "@/components/FontStep";
import GraphicStep from "@/components/GraphicStep";
import StyleBundleStep from "@/components/StyleBundleStep";
import DeckPreview from "@/components/DeckPreview";
import OutlineReview from "@/components/OutlineReview";
import MagicOverlay from "@/components/MagicOverlay";
import GenerateOverlay from "@/components/GenerateOverlay";
import ClarifyDialog from "@/components/ClarifyDialog";
import TemplateGallery from "@/components/TemplateGallery";
import Dashboard from "@/components/Dashboard";
import DashboardMobile from "@/components/DashboardMobile";
import { useDeviceMode } from "@/lib/deviceMode";
import { PRESET_THEMES, getTheme, type Theme } from "@/lib/themes";
import type { Deck, ContentDensity } from "@/lib/types";
import { applyTemplateToSlide, type TemplateVariantDefaults } from "@/lib/templates";
import { getStyleBundle, applyBundleToSlide, STYLE_BUNDLES } from "@/lib/styleBundles";
import { watchCustomTemplates, deleteCustomTemplate, type CustomTemplate } from "@/lib/customTemplates";
import { applyCustomTemplateToDeck } from "@/lib/applyCustomTemplate";
import { createDeck, loadDeck, type ShareMode } from "@/lib/decks";
import { logout, onAuthStateChange, getIdToken, reloadUser, type AppUser } from "@/lib/auth";
import { trackEvent } from "@/lib/stats";
import { readCredits, formatResetIn } from "@/lib/creditsClient";
import { ArrowLeft } from "lucide-react";

type Step = "dashboard" | "prompt" | "theme" | "font" | "graphic" | "style" | "outline" | "deck";

// useSearchParams() forces this route to render on each request rather than
// being prerendered at build time. Without this, the build complains that
// the hook isn't wrapped in a Suspense boundary.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={
      <main className="grid min-h-screen place-items-center text-sm"
            style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg-muted)" }}>
        Loading…
      </main>
    }>
      <PageInner />
    </Suspense>
  );
}

function PageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode: deviceMode, setMode: setDeviceMode, ready: deviceReady } = useDeviceMode();
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
      if (!u.emailVerified) {
        // Unverified users are bounced to /verify-email. They can
        // resend the email or come back here once verified.
        router.replace(`/verify-email?redirect=${encodeURIComponent("/app")}`);
        return;
      }
      setUser(u);
      setAuthReady(true);
      trackEvent({ kind: "page_view", path: "/app", ts: Date.now(), uid: u.uid });
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [router]);

  const [step, setStep] = useState<Step>("dashboard");
  const [prompt, setPrompt] = useState("");
  const [inputMode, setInputMode] = useState<"prompt" | "content">("prompt");
  const [sourceText, setSourceText] = useState("");
  const [slideCount, setSlideCount] = useState(8);
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [density, setDensity] = useState<ContentDensity>("balanced");
  // Tracks whether the user explicitly chose a density. Once they have,
  // picking a template must NOT override that choice.
  const [densityTouched, setDensityTouched] = useState(false);
  const chooseDensity = (d: ContentDensity) => { setDensity(d); setDensityTouched(true); };
  const [includeReferences, setIncludeReferences] = useState(false);
  const [theme, setTheme] = useState<Theme>(PRESET_THEMES[0]);
  const [graphicId, setGraphicId] = useState<string>("none");
  const [graphicAccent, setGraphicAccent] = useState<string | undefined>(undefined);
  const [fontId, setFontId] = useState<string>("inter");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [deckShareId, setDeckShareId] = useState<string | null>(null);
  const [deckShareMode, setDeckShareMode] = useState<ShareMode | null>(null);
  const [loading, setLoading] = useState(false);
  // 5s "designing" reveal animation after the outline is confirmed.
  const [designing, setDesigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Pre-generation clarifying step. requestGenerate() opens this; the
  // dialog returns tap-only directives that get folded into the prompt.
  const [clarifyOpen, setClarifyOpen] = useState(false);
  // Quota-exceeded popup (genz "chill, come back later" message).
  const [quotaModal, setQuotaModal] = useState(false);
  const [quotaResetIn, setQuotaResetIn] = useState("soon");
  // Synchronous lock so generate() can never run twice for one request
  // (would create two decks + double-charge quota).
  const generatingRef = useRef(false);
  // Signature of the inputs used for the last generation this session. If the
  // user asks for the exact same deck again, that's an implicit "regenerate":
  // we want a fresh take, not the identical cached one — so we tell the server
  // to bypass and refresh the generation cache (issue #141).
  const lastGenSigRef = useRef<string>("");
  // When a template is picked, we keep its variant defaults so we can apply
  // them to every slide once generation finishes.
  const [templateVariants, setTemplateVariants] = useState<TemplateVariantDefaults | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  // Custom (user-designed) templates.
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [activeCustomTemplate, setActiveCustomTemplate] = useState<CustomTemplate | null>(null);
  // Style bundle chosen on the "style" step — a self-consistent set of
  // per-layout variants layered onto every generated slide. Defaults to the
  // first bundle so generation always has a look even if the user rushes.
  const [styleBundleId, setStyleBundleId] = useState<string | null>(STYLE_BUNDLES[0].id);

  // Load an existing deck via ?id=... so "Open" links from /app/decks work.
  useEffect(() => {
    if (!user) return;
    const id = searchParams?.get("id");
    if (!id || deckId === id) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadDeck(user.uid, id);
        if (cancelled || !stored) return;
        setDeck(stored.deck);
        setTheme(stored.theme);
        setDeckId(id);
        setDeckShareId(stored.shareId ?? null);
        setDeckShareMode(stored.shareMode ?? null);
        setGraphicId(stored.deck.graphic || "none");
        setGraphicAccent(stored.deck.graphicAccent);
        setFontId(stored.deck.fontId || "inter");
        setStep("deck");
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[deck] load failed:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [user, searchParams, deckId]);

  // Watch the user's saved custom templates for the gallery.
  useEffect(() => {
    if (!user) return;
    const unsub = watchCustomTemplates(user.uid, setCustomTemplates);
    return () => unsub();
  }, [user]);

  // Mandatory pre-generation step: open the AI clarifying dialog. The
  // dialog calls back into generate() with the chosen directives. We
  // guard the quota here too so a user at their limit gets told before
  // we bother asking questions.
  const [lastDirectives, setLastDirectives] = useState("");
  const requestGenerate = async () => {
    if (user) {
      const c = await readCredits(user.uid);
      if (c.exhausted) {
        setQuotaResetIn(formatResetIn(c.resetAt));
        setQuotaModal(true);
        return;
      }
    }
    if (inputMode === "content") {
      if (sourceText.trim().length < 40) {
        setError("Paste a bit more of your content first (a paragraph or more).");
        return;
      }
    } else if (prompt.trim().length < 5) {
      setError("Add a sentence or two about your deck first.");
      return;
    }
    setError(null);
    setClarifyOpen(true);
  };
const retryGenerate = () => {
  if (!error) return;

  setError(null);
  generate(lastDirectives);
};

  const generate = async (directives = "") => {
    // Hard guard against a double-invoke (e.g. clarify completing twice, or
    // a Strict-Mode re-run). generate() creates a deck and burns quota, so
    // it must run at most once per request. `loading` is async state and
    // can lag, so we use a synchronous ref as the real lock.
    if (generatingRef.current) return;
    generatingRef.current = true;
    // Quota gate. Soft check on the client — Firebase rules + a server
    // round-trip after success keep the count honest, but a determined
    // user could still bypass via direct curl. Catches casual abuse.
    if (user) {
      const c = await readCredits(user.uid);
      if (c.exhausted) {
        setQuotaResetIn(formatResetIn(c.resetAt));
        setQuotaModal(true);
        generatingRef.current = false;
        return;
      }
    }

    setLoading(true);
    setError(null);
    // Minimum animation time of 10s so the overlay always feels intentional.
    const minDelay = new Promise<void>((r) => window.setTimeout(r, 10000));
    try {
      setLastDirectives(directives);
      // Decide whether this is a "regenerate" of an identical request. Only
      // the brief path is cached server-side, so the signature mirrors the
      // server's cache key inputs. If it matches the last generation this
      // session, the user is re-asking for the same deck and wants a fresh
      // result — so bypass + refresh the cache.
      const genSig = [
        prompt.trim().toLowerCase(), String(slideCount),
        (audience || "").toLowerCase(), (tone || "").toLowerCase(),
        (density || "").toLowerCase(), includeReferences ? "1" : "0",
        (directives || "").toLowerCase(),
      ].join("|");
      const regenerate = inputMode !== "content" && genSig === lastGenSigRef.current;
      lastGenSigRef.current = genSig;
      const doFetch = async (forceRefresh = false) => {
        const token = await getIdToken(forceRefresh);
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ prompt, slideCount, audience, tone, density, includeReferences, directives, regenerate, sourceText: inputMode === "content" ? sourceText : "" }),
        });
        return { res, data: await res.json().catch(() => ({})) };
      };

      const fetchPromise = (async () => {
        let { res, data } = await doFetch();
        // A freshly-verified user may still hold a pre-verification token
        // (email_verified: false). On 403, reload + force-refresh once
        // before treating it as genuinely unverified.
        if (res.status === 403) {
          try { await reloadUser(); } catch { /* ignore */ }
          ({ res, data } = await doFetch(true));
          if (res.status === 403) {
            window.location.href = `/verify-email?redirect=${encodeURIComponent("/app")}`;
            throw new Error("Email not verified");
          }
        }
        // One silent retry on rate limit / parse hiccups, with a 1.5s backoff.
        if (!res.ok && (data?.code === "rate_limit" || data?.code === "parse")) {
          await new Promise((r) => setTimeout(r, 1500));
          ({ res, data } = await doFetch());
        }
        if (!res.ok) {
          const code = data?.code;
          if (code === "rate_limit") {
            throw new Error("High traffic right now — give it a few seconds and try again.");
          }
          if (code === "auth") {
            throw new Error("There's an issue with the AI key. Try again in a moment.");
          }
          if (code === "parse") {
            throw new Error("The AI got tripped up generating this. Try once more — usually works.");
          }
          throw new Error(data?.error || "Generation failed");
        }
        return data;
      })();

      const [data] = await Promise.all([fetchPromise, minDelay]);
      // Apply the chosen look to every slide. If the user picked a concrete
      // template, its variants fill empty slots (AI choices still win). If
      // they picked a style bundle on the "style" step, that's a deliberate
      // choice and OVERRIDES the AI's per-slide variants so the deck matches
      // exactly what they previewed.
      const bundle = templateVariants ? null : getStyleBundle(styleBundleId);
      const styledSlides = bundle
        ? data.deck.slides.map((s: any) => {
            const styled = applyBundleToSlide(s, bundle);
            // Respect the AI's deliberate per-slide bullets layout (bands /
            // chevron / cards / …) so the deck varies instead of one repeated
            // look. The bundle still sets the other layout variants.
            return s.bulletsVariant ? { ...styled, bulletsVariant: s.bulletsVariant } : styled;
          })
        : templateVariants
          ? data.deck.slides.map((s: any) => applyTemplateToSlide(s, templateVariants))
          : data.deck.slides;
      // Concept is the default style only where a template hasn't specified
      // its own — so templates with a bespoke title/bullets design (e.g. the
      // reference-built covers) keep their look, while plain decks get Concept.
      // Auto-assign a COLORFUL bullets layout per slide, chosen by what the
      // content is and varied so no two adjacent slides look the same. We only
      // override plain/empty choices ("standard"/"dashed"/"numbered"/none) —
      // a deliberate colorful variant from the AI or bundle is kept.
      let prevVar = "";
      const SEQ_RE = /(process|pipeline|timeline|roadmap|journey|work\s?flow|steps?|phases?|stages?|how it works|how to|life\s?cycle|sequence|procedure|funnel|milestones?|getting started|onboarding|order of|flow\b)/i;
      const ENUM_RE = /(features?|modules?|pillars?|principles?|types?|categories|kinds?|components?|benefits?|advantages?|reasons?|factors?|capabilities|use cases?|offerings?|differentiators?|elements?|options?|services?)/i;
      const isSequential = (s: any): boolean => {
        const bs: string[] = s.bullets || [];
        const joined = bs.join(" ").toLowerCase();
        return SEQ_RE.test((s.title || "").toLowerCase())
          || bs.some((b) => /^(step|phase|stage)\s*\d/i.test(b.trim()) || /^\d+[.)]/.test(b.trim()))
          || /\b(first|second|third|then|next|after that|finally|lastly)\b/.test(joined);
      };
      const pickColorful = (s: any, i: number): string => {
        const bs: string[] = s.bullets || [];
        const n = bs.length;
        const title = (s.title || "").toLowerCase();
        const hasDetail = bs.some((b) => /\s[—–-]\s/.test(b));
        const avgLen = n ? bs.reduce((a, b) => a + b.length, 0) / n : 0;
        let cand: string;
        if (isSequential(s)) {
          // Steps / process / timeline content -> process arrows when the
          // labels are short, otherwise a vertical timeline.
          cand = (n <= 5 && avgLen <= 62 && !hasDetail) ? "chevron" : "timeline";
        } else if (ENUM_RE.test(title)) {
          // Distinct named items -> concept cards (primary) or big-number cards.
          cand = i % 3 === 1 ? "numbered-cards" : "concept-cards";
        } else if (n <= 6) {
          // Concept cards are the workhorse look; sprinkle bands for variety.
          cand = i % 3 === 2 ? "bands" : "concept-cards";
        } else {
          cand = "concept-cards";
        }
        // Avoid two identical NON-sequential variants in a row (keep sequence
        // visuals as-is — a process should look like a process).
        if (cand === prevVar && cand !== "chevron" && cand !== "timeline") {
          const alts = ["concept-cards", "numbered-cards", "bands"].filter((x) => x !== prevVar);
          cand = alts[i % alts.length];
        }
        return cand;
      };
      const slides = styledSlides.map((s: any, i: number) => {
        // AI side-by-side image slides must keep the simple "standard" bullets
        // variant (the left-column layout the renderer constrains for an image).
        if (s.imageRight) return { ...s, bulletsVariant: "standard" };
        let v: string | undefined = s.bulletsVariant;
        if (s.layout === "bullets") {
          // Content-first selection: the layout is chosen from what the slide
          // actually is (process -> arrows/timeline, named items -> concept/
          // number cards, etc.), so the right visual is used reliably instead
          // of whatever the model guessed.
          v = pickColorful(s, i);
          prevVar = v;
        }
        return {
          ...s,
          bulletsVariant: v || "concept-cards",
          ...(s.layout === "title-hero" && !s.titleVariant ? { titleVariant: "concept-hero" } : {}),
        };
      });
      const baseDeck: Deck = { ...data.deck, slides, graphic: graphicId, graphicAccent, fontId };

      // If the user picked one of their custom templates, re-skin the whole
      // deck to follow it exactly (colors/fonts/background/decorations),
      // overriding the default look. Content/structure is untouched.
      let deckWithExtras = baseDeck;
      let effectiveTheme = theme;
      if (activeCustomTemplate) {
        const applied = applyCustomTemplateToDeck(baseDeck, activeCustomTemplate);
        deckWithExtras = applied.deck;
        effectiveTheme = applied.theme;
        setTheme(applied.theme);
      }
      setDeck(deckWithExtras);
      setStep("outline");

      // Persist a fresh row in Firebase so the deck survives a refresh.
      // Failures (network blip, missing auth, etc.) shouldn't block the user
      // from continuing to work on the deck — but we want to know loudly so
      // we can react with a visible error.
      if (user) {
        // Quota is counted server-side in /api/generate (non-bypassable).
        // The dashboard's live watcher picks up the new monthly value.
        try {
          const id = await createDeck(user.uid, deckWithExtras, effectiveTheme);
          setDeckId(id);
          // Reflect the id in the URL so a refresh recovers the deck.
          try {
            const url = new URL(window.location.href);
            url.searchParams.set("id", id);
            window.history.replaceState({}, "", url.toString());
          } catch { /* ignore */ }
        } catch (saveErr: any) {
          // eslint-disable-next-line no-console
          console.error("[deck] create failed:", saveErr);
          setError(`Couldn't save the deck to your account. ${saveErr?.message || ""}`.trim());
        }
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
      generatingRef.current = false;
    }
  };

  const restart = () => {
    setStep("dashboard");
    setDeck(null);
    setDeckId(null);
    setSourceText("");
    setInputMode("prompt");
    // Drop the ?id from the URL on restart so refreshing doesn't re-open
    // the deck the user just left.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    } catch { /* ignore */ }
  };

  // Outline confirmed → play the 5s "designing" animation, then reveal the deck.
  const confirmOutline = () => {
    setDesigning(true);
    window.setTimeout(() => {
      setDesigning(false);
      setStep("deck");
    }, 5000);
  };

  if (!authReady) {
    return (
      <main className="grid min-h-screen place-items-center text-sm"
            style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg-muted)" }}>
        Loading…
      </main>
    );
  }

  const isDeckStep = step === "deck";
  const isDashboard = step === "dashboard";
  const fullBleed = isDeckStep || isDashboard;

  // Dashboard owns its own layout; render it standalone.
  if (isDashboard && user) {
    // Mobile mode: a dedicated touch-first dashboard. Desktop is unchanged.
    if (deviceReady && deviceMode === "mobile") {
      return (
        <main className="relative min-h-screen text-white" style={{ background: "var(--ezd-bg-page)" }}>
          <DashboardMobile
            user={user}
            onStartFromScratch={() => setStep("prompt")}
            onStartFromTemplate={() => { setStep("prompt"); setGalleryOpen(true); }}
            onSignOut={async () => { await logout(); router.replace("/"); }}
            onSwitchToDesktop={() => { setDeviceMode("desktop"); try { window.location.reload(); } catch { /* ignore */ } }}
          />
        </main>
      );
    }
    return (
      <main className="relative min-h-screen text-white" style={{ background: "var(--ezd-bg-page)" }}>
        <div aria-hidden className="landing-bg" />
        <div className="relative z-10">
          <Dashboard
            user={user}
            onStartFromScratch={() => setStep("prompt")}
            onStartFromTemplate={() => { setStep("prompt"); setGalleryOpen(true); }}
            onSignOut={async () => { await logout(); router.replace("/"); }}
          />
        </div>
      </main>
    );
  }

  // Style-bundle picker owns the full screen, like the dashboard.
  if (step === "style") {
    return (
      <main className="relative min-h-screen text-white" style={{ background: "var(--ezd-bg-page)" }}>
        <div aria-hidden className="landing-bg" />
        <div className="relative z-10 px-4 py-10 sm:px-8 lg:py-14">
          <StyleBundleStep
            theme={theme}
            fontId={fontId}
            graphicId={graphicId}
            graphicAccent={graphicAccent}
            selectedBundleId={styleBundleId}
            onSelect={setStyleBundleId}
            onBack={() => setStep("graphic")}
            onGenerate={() => generate(lastDirectives)}
            loading={loading}
          />
        </div>
        <GenerateOverlay
          open={loading || !!error}
          error={error}
          loading={loading}
          onRetry={retryGenerate}
        />
      </main>
    );
  }

  return (
    <main
      className={`relative min-h-screen ${
        fullBleed ? "px-4 py-6 sm:px-8" : "px-4 py-10 sm:px-8"
      }`}
      style={{ background: "var(--ezd-bg-page)" }}
    >
      {!isDeckStep && <div aria-hidden className="landing-bg" />}
      <div className="relative z-10">
      {!fullBleed && step !== "prompt" && (
        <div className="mx-auto mb-6 flex max-w-6xl justify-end">
          <button
            onClick={() => setStep("dashboard")}
            className="group inline-flex items-center gap-1.5 text-[12px] text-white/55 transition hover:text-white"
          >
            <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
            Dashboard
          </button>
        </div>
      )}

      {step === "prompt" && (
        <PromptStep
          prompt={prompt}
          setPrompt={setPrompt}
          inputMode={inputMode}
          setInputMode={setInputMode}
          sourceText={sourceText}
          setSourceText={setSourceText}
          slideCount={slideCount}
          setSlideCount={setSlideCount}
          audience={audience}
          setAudience={setAudience}
          tone={tone}
          setTone={setTone}
          density={density}
          setDensity={chooseDensity}
          includeReferences={includeReferences}
          setIncludeReferences={setIncludeReferences}
          onNext={() => setStep("theme")}
          onUseTemplate={() => setGalleryOpen(true)}
          activeTemplateName={templateName || undefined}
          onGenerateDirect={requestGenerate}
          generateLoading={loading}
          onBack={() => setStep("dashboard")}
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
          onGenerate={requestGenerate}
          loading={loading}
        />
      )}

      {step === "outline" && deck && (
        <OutlineReview
          deck={deck}
          setDeck={setDeck}
          theme={theme}
          onConfirm={confirmOutline}
          onBack={() => setStep("prompt")}
        />
      )}

      {step === "deck" && deck && (
        <DeckPreview
          deck={deck}
          setDeck={setDeck}
          theme={theme}
          setTheme={setTheme}
          onRestart={restart}
          deckId={deckId}
          user={user}
          initialShareId={deckShareId}
          initialShareMode={deckShareMode}
        />
      )}

      {/* Full-screen "deck is being prepared" overlay. Mounts as soon as
          loading flips on (i.e. when the user clicks Generate on the
          GraphicStep) and unmounts after both the API call and a 10s
          minimum animation finish. */}
<GenerateOverlay
  open={loading || !!error}
  error={error}
  loading={loading}
  onRetry={retryGenerate}
/>

      {/* 5s "EXdeck is doing the magic" reveal after the outline is confirmed. */}
      <MagicOverlay open={designing} />

      {/* Mandatory AI clarifying step before generation. Returns tap-only
          directives that get folded into the generation prompt. */}
      <ClarifyDialog
        open={clarifyOpen}
        prompt={prompt}
        sourceText={inputMode === "content" ? sourceText : ""}
        audience={audience}
        tone={tone}
        slideCount={slideCount}
        onClose={() => setClarifyOpen(false)}
        onComplete={(directives) => {
          setClarifyOpen(false);
          setLastDirectives(directives);
          // Template already sets the look, so skip the theme/style steps
          // and generate straight away.
          generate(directives);
        }}
      />

      <TemplateGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        customTemplates={customTemplates}
        onPickCustom={(t) => {
          // Use a custom template: clear preset variants, mark it active so
          // generation re-skins the deck to follow it exactly.
          setActiveCustomTemplate(t);
          setTemplateVariants(null);
          setTemplateName(t.name);
          setStep("prompt");
        }}
        onDeleteCustom={(t) => {
          if (user) deleteCustomTemplate(user.uid, t.id).catch(() => {});
          if (activeCustomTemplate?.id === t.id) setActiveCustomTemplate(null);
        }}
        onPick={(t) => {
          setActiveCustomTemplate(null);
          const picked = getTheme(t.themeId);
          if (picked) setTheme(picked);
          setFontId(t.fontId);
          setGraphicId(t.graphicId);
          setGraphicAccent(t.graphicAccent);
          if (t.density && !densityTouched) setDensity(t.density);
          if (typeof t.includeReferences === "boolean") setIncludeReferences(t.includeReferences);
          // Seed the prompt only when empty so we don't trample what the user
          // has already typed.
          if (!prompt.trim()) setPrompt(t.samplePrompt);
          setTemplateVariants(t.variants);
          setTemplateName(t.name);
        }}
      />

      {/* First-visit walkthrough. Self-disables after one show. */}

      {/* Quota-exceeded popup — shown if a user hits Generate after using
          all their daily runs. */}
      {quotaModal && (
        <div
          className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setQuotaModal(false); }}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border p-6 text-center"
            style={{ background: "var(--ezd-bg-elev)", borderColor: "var(--ezd-divider)" }}
          >
            <div className="mx-auto mb-4 text-4xl" aria-hidden>🫠</div>
            <h3 className="text-[18px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
              you&rsquo;ve hit your monthly limit
            </h3>
            <p className="mx-auto mt-2 max-w-[19rem] text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
              you&rsquo;ve used all your decks for this month on the free plan.
              it resets in <span className="font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{quotaResetIn}</span>,
              or upgrade from the dashboard for more.
            </p>
            <button
              onClick={() => setQuotaModal(false)}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-[13px] font-semibold transition hover:brightness-110"
              style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
            >
              bet, i&rsquo;ll wait
            </button>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}


