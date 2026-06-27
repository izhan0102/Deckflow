"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Monitor, X } from "lucide-react";

/**
 * Soft mobile notice. Centered modal popup on narrow viewports that
 * dismisses with a close button. Once dismissed the rest of the site is
 * fully usable; we don't gate access.
 *
 * Behavior:
 *   - Shown on narrow / coarse-pointer viewports.
 *   - One-tap dismiss; remembered for 7 days via localStorage.
 *   - Has a faint dim overlay but the modal isn't a blocker — closing it
 *     reveals the underlying page exactly as before.
 */

const STORAGE_KEY = "deckflow_mobile_notice_v2";

export default function MobileGate() {
  const [show, setShow] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Show the "made for desktop" notice ONLY on the app + interactive tool
    // routes (dashboard, editors, tools). NEVER on the landing or any
    // marketing/SEO/content page — a mobile interstitial there hurts Google's
    // mobile-first ranking. (On /app the editor already forces a desktop
    // viewport via DesktopOnMobile, so this rarely triggers there.)
    const GATE_ROUTES = ["/app", "/docs", "/spreadsheet", "/pdf-to-ppt", "/resume", "/analyse"];
    const onAppRoute = GATE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
    if (!onAppRoute) {
      setShow(false);
      return;
    }

    const isMobileView = () => {
      const narrow = window.innerWidth < 900;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      return narrow || (window.innerWidth < 1100 && coarse);
    };

    const isDismissed = () => {
      try {
        const until = Number(window.localStorage.getItem(STORAGE_KEY) || 0);
        return until > Date.now();
      } catch {
        return false;
      }
    };

    const refresh = () => setShow(isMobileView() && !isDismissed());

    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
    };
  }, [pathname]);

  const dismiss = () => {
    try {
      // Hide for 7 days so it doesn't follow the user around forever.
      const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
      window.localStorage.setItem(STORAGE_KEY, String(until));
    } catch { /* ignore */ }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mobile experience notice"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(5, 5, 7, 0.6)",
        backdropFilter: "blur(4px)",
        animation: "deckflow-mobile-popup-bg 180ms ease",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: 360,
          width: "100%",
          padding: "22px 22px 20px",
          borderRadius: 18,
          background: "linear-gradient(to bottom, #0f0f12, #0a0a0c)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 30px 80px -20px rgba(0, 0, 0, 0.7)",
          color: "#fff",
          textAlign: "center",
          animation: "deckflow-mobile-popup-in 220ms cubic-bezier(.2,.7,.2,1)",
        }}
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 28,
            height: 28,
            display: "grid",
            placeItems: "center",
            borderRadius: 8,
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "rgba(255, 255, 255, 0.7)",
            cursor: "pointer",
          }}
        >
          <X size={14} />
        </button>

        <div
          style={{
            margin: "0 auto 14px",
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            borderRadius: 12,
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <Monitor size={20} color="#FFFFFF" />
        </div>

        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}>
          EXdeck is made for desktop
        </h2>
        <p
          style={{
            margin: "8px 0 16px",
            fontSize: 13,
            lineHeight: 1.5,
            color: "rgba(255, 255, 255, 0.65)",
          }}
        >
          The editor may not work properly on phones. Consider switching to a
          laptop or desktop browser for the best experience.
        </p>

        <button
          onClick={dismiss}
          style={{
            display: "inline-block",
            padding: "9px 16px",
            borderRadius: 12,
            background: "#fff",
            color: "#000",
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Got it, continue anyway
        </button>
      </div>

      <style jsx global>{`
        @keyframes deckflow-mobile-popup-bg {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes deckflow-mobile-popup-in {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
