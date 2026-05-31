"use client";
import { useEffect } from "react";

/**
 * Locks the document to the dark theme while mounted, then restores the
 * user's saved preference on unmount.
 *
 * The editor (/app) is a dark-designed surface — its backgrounds are
 * hardcoded navy and its panels, overlays, and menus assume a dark
 * canvas. The site-wide light theme is meant for the marketing pages
 * (landing, legal), not the app. Forcing dark here keeps the editor,
 * the generate overlay, and the slide-rail menus readable regardless of
 * what theme the user picked on the landing page.
 */
export default function ForceDarkTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme") || "dark";
    html.setAttribute("data-theme", "dark");
    return () => {
      // Restore the user's actual saved preference when leaving /app.
      let restore = prev;
      try {
        const stored = localStorage.getItem("ezdeck_theme");
        if (stored === "light" || stored === "dark") restore = stored;
      } catch { /* ignore */ }
      html.setAttribute("data-theme", restore);
    };
  }, []);
  return null;
}
