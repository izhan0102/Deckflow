"use client";
import { useEffect } from "react";

/**
 * Force the editor to render in "desktop mode" on phones.
 *
 * Why: the editor is a drag/drop slide canvas with a left rail, the
 * stage, a right inspector, and a chat row. The mobile-responsive
 * version just doesn't fit on a 360px screen, and a phone-shaped
 * editor makes the product feel half-built.
 *
 * What this does on phones:
 *   - Replaces the default `width=device-width` viewport meta with a
 *     fixed 1280-pixel logical width. The browser renders the page at
 *     1280px wide and lets the user pinch-zoom. Same effect as the
 *     "Desktop site" toggle in mobile Chrome.
 *   - We compute the initial scale so the full 1280px width is visible
 *     on first paint (no horizontal scroll). The user can still zoom in.
 *   - On orientation change we recompute the initial-scale so the page
 *     fits the new screen width.
 *
 * Phones only. Tablets, iPad (which sends a desktop UA on iPadOS 13+),
 * and real desktops are not touched.
 *
 * On unmount (e.g. user navigates away from the editor), we restore the
 * original viewport tag so the rest of the site stays mobile-responsive.
 */
export default function DesktopOnMobile() {
  useEffect(() => {
    // Phone-only — never tablets or desktop UAs.
    if (typeof navigator === "undefined") return;

    // Respect the user's chosen device mode. In "mobile" mode the app uses
    // its own responsive mobile shells, so we must NOT force a 1280px
    // viewport. When there's no explicit choice, a phone defaults to mobile
    // mode (see lib/deviceMode), so we skip forcing there too. Only force
    // the desktop viewport when the user explicitly picked "desktop".
    const storedMode = (() => {
      try { return window.localStorage.getItem("ezdeck_device_mode"); } catch { return null; }
    })();
    if (storedMode === "mobile") return;

    const ua = navigator.userAgent || "";
    // Treat anything reporting iPhone, iPod, Android Mobile, Mobile
    // Safari, Windows Phone, BlackBerry as a phone. iPads send a
    // desktop UA in modern iPadOS, so they fall through here naturally.
    const isPhone =
      /iPhone|iPod/.test(ua) ||
      /Windows Phone/i.test(ua) ||
      /BlackBerry|BB10/.test(ua) ||
      // Android: only count "Mobile" — Android tablets omit it.
      (/Android/.test(ua) && /Mobile/.test(ua)) ||
      // Generic mobile fallback (some Edge mobile flavors etc.).
      /Mobi(?!Gen)/i.test(ua);

    if (!isPhone) return;
    // A phone with no explicit choice defaults to mobile mode, which uses
    // responsive shells — don't force the desktop viewport. Only force it
    // when the user explicitly opted into desktop mode on a phone.
    if (storedMode !== "desktop") return;
    if (typeof document === "undefined") return;

    const head = document.head;
    let viewport = head.querySelector(
      'meta[name="viewport"]',
    ) as HTMLMetaElement | null;

    // Snapshot the original content so we can restore it on unmount.
    const originalContent = viewport?.getAttribute("content") || null;

    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.setAttribute("name", "viewport");
      head.appendChild(viewport);
    }

    /** Width we want the page to be laid out at. 1280 matches the
     *  app's max sidebar+stage width and reads consistently across
     *  layouts. */
    const VIRTUAL_WIDTH = 1280;

    const apply = () => {
      // Aim for "full virtual width visible on first paint" — the user
      // can pinch in further. Compute the scale that makes 1280 logical
      // pixels match the actual screen width.
      const screen = Math.max(320, window.screen.width || window.innerWidth);
      const initialScale = Math.min(1, screen / VIRTUAL_WIDTH);

      viewport!.setAttribute(
        "content",
        [
          `width=${VIRTUAL_WIDTH}`,
          `initial-scale=${initialScale.toFixed(3)}`,
          // Let the user zoom in to read; clamp so they don't end up
          // stuck at 5x on a tap.
          `minimum-scale=${initialScale.toFixed(3)}`,
          "maximum-scale=2.5",
          "user-scalable=yes",
          "viewport-fit=cover",
        ].join(", "),
      );
    };

    apply();

    // Recompute on rotation so portrait → landscape doesn't end up
    // cropped or super zoomed-out.
    const onResize = () => apply();
    window.addEventListener("orientationchange", onResize);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("resize", onResize);

      // Restore the original viewport so other routes stay mobile-fit.
      if (viewport) {
        if (originalContent != null) {
          viewport.setAttribute("content", originalContent);
        } else {
          viewport.parentNode?.removeChild(viewport);
        }
      }
    };
  }, []);

  return null;
}
