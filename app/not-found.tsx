import Link from "next/link";
import { ArrowRight, Home, LayoutDashboard } from "lucide-react";
import Logo from "@/components/Logo";

/**
 * Custom 404 page for EXdeck.
 *
 * Follows the project's monochrome design language: pure black in dark mode,
 * pure white in light mode, driven by the --ezd-bg-page and --ezd-fg tokens.
 */

const DISPLAY = '"Bricolage Grotesque", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';

export default function NotFound() {
  return (
    <>
      <main
        className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}
      >
        {/* Light-mode dot texture (invisible in dark) matching the landing. */}
        <div aria-hidden className="landing-bg" />

        <div className="relative z-10 flex flex-col items-center">
          <Logo size="md" href="/" className="mb-12" />

          <h1
            className="font-extrabold tracking-tighter"
            style={{
              fontFamily: DISPLAY,
              fontSize: "clamp(80px, 15vw, 160px)",
              lineHeight: 0.8,
              color: "var(--ezd-fg-strong)",
            }}
          >
            404
          </h1>

          <h2
            className="mt-6 text-2xl font-semibold tracking-tight sm:text-[28px]"
            style={{ fontFamily: DISPLAY, color: "var(--ezd-fg-strong)" }}
          >
            Page not found
          </h2>

          <p
            className="mt-4 max-w-[400px] text-[14.5px] leading-relaxed sm:text-[15.5px]"
            style={{ color: "var(--ezd-fg-muted)" }}
          >
            The page you&apos;re looking for doesn&apos;t exist or has been moved to a new URL.
            Let&apos;s get you back on track.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 rounded-full px-7 py-3 text-[14.5px] font-semibold transition hover:opacity-90"
              style={{
                background: "var(--ezd-button-strong)",
                color: "var(--ezd-button-strong-fg)",
              }}
            >
              <Home size={16} />
              Go home
            </Link>
            <Link
              href="/app"
              className="group inline-flex items-center gap-2 rounded-full border px-7 py-3 text-[14.5px] font-medium transition hover:border-white/25"
              style={{
                borderColor: "var(--ezd-hairline)",
                background: "var(--ezd-bg-card)",
                color: "var(--ezd-fg-strong)",
              }}
            >
              <LayoutDashboard size={16} />
              Open dashboard
              <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </main>

      <footer
        className="fixed bottom-8 left-0 right-0 z-20 text-center text-[12px]"
        style={{ color: "var(--ezd-fg-quiet)" }}
      >
        &copy; {new Date().getFullYear()} EXdeck
      </footer>
    </>
  );
}
