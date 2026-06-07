"use client";
import { useEffect, useState, useCallback } from "react";

/**
 * Device "mode" for the app shell.
 *
 * - On first visit we AUTO-DETECT whether the user is on a phone and pick
 *   "mobile" or "desktop" accordingly.
 * - The user can override this from the dashboard; the choice is persisted
 *   to localStorage and wins on subsequent visits.
 * - Desktop mode is the original experience and is left untouched. Mobile
 *   mode swaps in mobile-optimized shells (currently the dashboard).
 */

export type DeviceMode = "desktop" | "mobile";

const STORAGE_KEY = "ezdeck_device_mode";

/** Heuristic phone detection (UA + viewport + coarse pointer). */
export function detectIsPhone(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const uaPhone =
    /iPhone|iPod/.test(ua) ||
    /Windows Phone/i.test(ua) ||
    /BlackBerry|BB10/.test(ua) ||
    (/Android/.test(ua) && /Mobile/.test(ua)) ||
    /Mobi(?!Gen)/i.test(ua);
  const narrow = window.innerWidth < 820;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return uaPhone || (narrow && coarse);
}

function readStored(): DeviceMode | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "mobile" || v === "desktop" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Returns the current device mode plus setters. `ready` is false until the
 * client has resolved the mode, so callers can avoid a desktop→mobile flash
 * during hydration.
 */
export function useDeviceMode() {
  const [mode, setModeState] = useState<DeviceMode>("desktop");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStored();
    setModeState(stored ?? (detectIsPhone() ? "mobile" : "desktop"));
    setReady(true);
  }, []);

  const setMode = useCallback((next: DeviceMode) => {
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    setModeState(next);
  }, []);

  const toggle = useCallback(() => {
    setModeState((cur) => {
      const next = cur === "mobile" ? "desktop" : "mobile";
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { mode, setMode, toggle, ready };
}
