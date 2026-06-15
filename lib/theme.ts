"use client";
import { useEffect, useState } from "react";

/**
 * Site-wide theme.
 *
 * Two values: "dark" (default, navy + cyan), "light" (cream + ink).
 * Persisted in localStorage so it survives reloads, and read live so
 * a switch in one tab updates other tabs through the `storage` event.
 *
 * `data-theme` is set on <html>. CSS variables and Tailwind utility
 * overrides in app/globals.css drive the actual visual swap.
 *
 * Boot order:
 *   1. <head> runs an inline script (THEME_BOOT_SCRIPT below) that
 *      sets `data-theme` synchronously based on stored preference or
 *      `prefers-color-scheme`. This prevents a dark→light flash on
 *      load for users who picked light.
 *   2. ThemeProvider mounts, reads the same source of truth, mirrors
 *      it into a React state so components can render conditionally.
 *   3. setTheme() updates localStorage, the <html> attribute, and
 *      dispatches a custom event so all `useTheme()` consumers in
 *      this tab re-render at once.
 */

export type Theme = "dark" | "light";

const STORAGE_KEY = "ezdeck_theme_v2";
const EVENT = "ezdeck:theme-changed";

/**
 * Inline script that runs in <head> before any paint. Returns a
 * stringified function so we can drop it into a <script> tag via
 * dangerouslySetInnerHTML. Must be self-contained (no imports).
 */
export const THEME_BOOT_SCRIPT = `
(function () {
  // Brand default: the site ALWAYS boots in light mode. The header toggle
  // still flips dark live for the current session, but a reload returns to
  // light — so the site can never "auto-switch" to dark on refresh.
  try {
    document.documentElement.setAttribute("data-theme", "light");
  } catch (e) {}
})();
`;

/** Read the currently-applied theme from <html data-theme>. */
function readCurrent(): Theme {
  if (typeof document === "undefined") return "light";
  const v = document.documentElement.getAttribute("data-theme");
  return v === "dark" ? "dark" : "light";
}

/** Apply a theme live for this session. NOT persisted — the boot script
 *  always starts the site in light, so dark never comes back on refresh. */
function applyTheme(next: Theme) {
  if (typeof window === "undefined") return;
  document.documentElement.setAttribute("data-theme", next);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { theme: next } }));
}

/**
 * Hook used by any component that wants to read or set the theme.
 *
 * Returns `[theme, setTheme, toggle]`. Subscribing components re-render
 * whenever the theme changes (this tab via custom event, other tabs via
 * the `storage` event).
 */
export function useTheme(): [Theme, (next: Theme) => void, () => void] {
  // Start with a placeholder so server render and client first paint
  // agree. The `useEffect` immediately syncs to the real applied
  // theme without a flash because the boot script already set
  // <html data-theme> before React hydrated.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(readCurrent());

    const onSame = (e: Event) => {
      const detail = (e as CustomEvent).detail as { theme?: Theme } | undefined;
      if (detail?.theme === "light" || detail?.theme === "dark") {
        setTheme(detail.theme);
      } else {
        setTheme(readCurrent());
      }
    };
    const onCross = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const v = e.newValue;
      if (v === "light" || v === "dark") {
        // Other tab changed the value — mirror the change into our DOM.
        document.documentElement.setAttribute("data-theme", v);
        setTheme(v);
      }
    };

    window.addEventListener(EVENT, onSame);
    window.addEventListener("storage", onCross);
    return () => {
      window.removeEventListener(EVENT, onSame);
      window.removeEventListener("storage", onCross);
    };
  }, []);

  const set = (next: Theme) => {
    if (next !== "light" && next !== "dark") return;
    applyTheme(next);
    setTheme(next);
  };
  // Read the live applied theme from the DOM at click time rather than the
  // React state, which can lag for one render right after mount (the state
  // starts at "light" and syncs in useEffect). Without this, a quick click
  // before the sync could flip the wrong way.
  const toggle = () => set(readCurrent() === "light" ? "dark" : "light");

  return [theme, set, toggle];
}
