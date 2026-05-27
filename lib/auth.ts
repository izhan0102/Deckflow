/**
 * Auth: real Firebase if configured; localStorage fallback otherwise.
 *
 * Public surface (used by pages/components) stays the same:
 *   getCurrentUser, isLoggedIn, loginWithEmail, signupWithEmail,
 *   loginWithGoogle, logout, onAuthStateChange.
 */

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FBUser,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";

const USER_KEY = "deckflow_user";

export type AppUser = {
  uid: string;
  email: string;
  name?: string;
  photoUrl?: string;
  provider: "password" | "google" | "local";
};

/* ---------------------------- Local fallback ----------------------------- */

function readLocal(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch { return null; }
}
function writeLocal(u: AppUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (u) window.localStorage.setItem(USER_KEY, JSON.stringify(u));
    else window.localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new CustomEvent("deckflow:auth-change"));
  } catch { /* ignore */ }
}

function fbToApp(u: FBUser, provider: AppUser["provider"]): AppUser {
  return {
    uid: u.uid,
    email: u.email || "",
    name: u.displayName || (u.email || "").split("@")[0],
    photoUrl: u.photoURL || undefined,
    provider,
  };
}

/* ----------------------------- Public API -------------------------------- */

export function getCurrentUser(): AppUser | null {
  // Synchronous accessor; mirrors latest Firebase user into localStorage so
  // SSR-safe pages can read it without waiting for an auth listener.
  if (typeof window === "undefined") return null;
  const auth = getFirebaseAuth();
  if (auth?.currentUser) {
    const provider: AppUser["provider"] =
      auth.currentUser.providerData[0]?.providerId === "google.com" ? "google" : "password";
    const u = fbToApp(auth.currentUser, provider);
    writeLocal(u);
    return u;
  }
  return readLocal();
}

export function isLoggedIn(): boolean { return !!getCurrentUser(); }

export function onAuthStateChange(cb: (u: AppUser | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    // Local-only fallback: react to our custom event.
    const handler = () => cb(readLocal());
    window.addEventListener("deckflow:auth-change", handler);
    handler();
    return () => window.removeEventListener("deckflow:auth-change", handler);
  }
  return onAuthStateChanged(auth, (u) => {
    if (!u) {
      writeLocal(null);
      cb(null);
      return;
    }
    const provider: AppUser["provider"] =
      u.providerData[0]?.providerId === "google.com" ? "google" : "password";
    const app = fbToApp(u, provider);
    writeLocal(app);
    cb(app);
  });
}

export async function loginWithEmail(email: string, password: string): Promise<AppUser> {
  if (!email || password.length < 6) throw new Error("Invalid email or password.");
  const auth = getFirebaseAuth();
  if (!auth) {
    const u: AppUser = { uid: `local_${btoa(email).slice(0, 16)}`, email, name: email.split("@")[0], provider: "local" };
    writeLocal(u);
    return u;
  }
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const app = fbToApp(cred.user, "password");
  writeLocal(app);
  return app;
}

export async function signupWithEmail(name: string, email: string, password: string): Promise<AppUser> {
  if (!email || password.length < 6) throw new Error("Invalid email or password (min 6 chars).");
  const auth = getFirebaseAuth();
  if (!auth) {
    const u: AppUser = { uid: `local_${btoa(email).slice(0, 16)}`, email, name: name || email.split("@")[0], provider: "local" };
    writeLocal(u);
    return u;
  }
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    try { await updateProfile(cred.user, { displayName: name }); } catch { /* non-fatal */ }
  }
  const app = fbToApp(cred.user, "password");
  if (name) app.name = name;
  writeLocal(app);
  return app;
}

export async function loginWithGoogle(): Promise<AppUser> {
  const auth = getFirebaseAuth();
  if (!auth) {
    // Local-only stub for dev without firebase env vars.
    const fake: AppUser = { uid: "local_google_demo", email: "you@example.com", name: "EZdeck user", provider: "local" };
    writeLocal(fake);
    return fake;
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(auth, provider);
  const app = fbToApp(cred.user, "google");
  writeLocal(app);
  return app;
}

export async function logout(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) {
    try { await signOut(auth); } catch { /* ignore */ }
  }
  writeLocal(null);
}

export async function getIdToken(): Promise<string> {
  const auth = getFirebaseAuth();
  if (auth?.currentUser) {
    return await auth.currentUser.getIdToken();
  }
  const local = readLocal();
  if (local?.uid.startsWith("local_")) {
    return local.uid;
  }
  return "";
}

export const firebaseEnabled = isFirebaseConfigured;
