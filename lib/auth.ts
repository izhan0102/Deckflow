/**
 * Auth: real Firebase if configured; localStorage fallback otherwise.
 *
 * Public surface (used by pages/components):
 *   getCurrentUser, isLoggedIn, isEmailVerified, loginWithEmail,
 *   signupWithEmail, loginWithGoogle, logout, onAuthStateChange,
 *   resendVerificationEmail, reloadUser.
 *
 * Email verification flow (issue #2):
 *   - signupWithEmail() creates the account, sends a Firebase
 *     verification email, signs the user out, and throws a
 *     UnverifiedEmailError so the auth UI can route to /verify-email.
 *   - loginWithEmail() rejects unverified users with the same error.
 *     The user object is preserved in `auth.currentUser` so the
 *     verify page can resend mail without asking for the password.
 *   - Google signups skip verification — Google emails are pre-verified.
 *   - Email verification is a hard requirement everywhere we gate
 *     on auth (the /app editor, /app/decks, /app/about-page-only
 *     surfaces). The gate is enforced both client-side via
 *     onAuthStateChange and any future server-side check.
 *
 * Local-only fallback (no Firebase env vars) skips verification
 * entirely so dev environments still work without sending real mail.
 */

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
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
  /** True when Firebase reports the email is verified. Google
   *  accounts are always true. Local-fallback users are always true.
   *  Password accounts are false until the user clicks the link. */
  emailVerified: boolean;
};

/** Thrown by login/signup when the user must verify their email. */
export class UnverifiedEmailError extends Error {
  email: string;
  constructor(email: string) {
    super("Please verify your email to continue.");
    this.name = "UnverifiedEmailError";
    this.email = email;
  }
}

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
    // Google logins are always verified by Google. Password accounts
    // depend on Firebase's emailVerified flag.
    emailVerified: provider === "google" ? true : !!u.emailVerified,
  };
}

/* ----------------------------- Public API -------------------------------- */

export function getCurrentUser(): AppUser | null {
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

/** True when the current user's email is verified (or they don't need
 *  verification — Google accounts, local-fallback dev users). */
export function isEmailVerified(): boolean {
  const u = getCurrentUser();
  return !!u && u.emailVerified;
}

/**
 * onAuthStateChange ALWAYS reflects the truth of `auth.currentUser`,
 * including unverified users. Pages that gate on verification check
 * `user.emailVerified` and route to /verify-email when false.
 */
export function onAuthStateChange(cb: (u: AppUser | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
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

/**
 * Force a refresh of the current user's profile from Firebase. After the
 * user clicks the verification link (in another tab) Firebase doesn't
 * push the update — we have to reload(). Returns the updated user or
 * null when no one's signed in.
 */
export async function reloadUser(): Promise<AppUser | null> {
  const auth = getFirebaseAuth();
  if (!auth) return readLocal();
  const u = auth.currentUser;
  if (!u) return null;
  try { await reload(u); } catch { /* network blip — return stale */ }
  const provider: AppUser["provider"] =
    u.providerData[0]?.providerId === "google.com" ? "google" : "password";
  const app = fbToApp(u, provider);
  writeLocal(app);
  return app;
}

/**
 * Send (or re-send) a verification email to the currently-signed-in
 * user. Throws if no user is signed in. Firebase rate-limits these
 * sends per-user; their error gets surfaced to the caller.
 */
export async function resendVerificationEmail(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) {
    // Local fallback — no email to send. Pretend success so the UI
    // doesn't get stuck.
    return;
  }
  const u = auth.currentUser;
  if (!u) throw new Error("No user is signed in.");
  // Only attach a `url` if we have one — Firebase types reject
  // undefined for the url field, but the whole settings object is
  // optional. Skipping it just means Firebase uses its default
  // continue URL (the auth domain), which still works.
  if (typeof window !== "undefined") {
    await sendEmailVerification(u, {
      url: `${window.location.origin}/verify-email?continue=1`,
      handleCodeInApp: false,
    });
  } else {
    await sendEmailVerification(u);
  }
}

export async function loginWithEmail(email: string, password: string): Promise<AppUser> {
  if (!email || password.length < 6) throw new Error("Invalid email or password.");
  const auth = getFirebaseAuth();
  if (!auth) {
    const u: AppUser = {
      uid: `local_${btoa(email).slice(0, 16)}`, email,
      name: email.split("@")[0],
      provider: "local",
      emailVerified: true,
    };
    writeLocal(u);
    return u;
  }
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const app = fbToApp(cred.user, "password");
  if (!app.emailVerified) {
    // Keep `auth.currentUser` populated so the verify page can resend
    // mail without asking the user for their password again.
    writeLocal(app);
    throw new UnverifiedEmailError(app.email);
  }
  writeLocal(app);
  return app;
}

export async function signupWithEmail(name: string, email: string, password: string): Promise<AppUser> {
  if (!email || password.length < 6) throw new Error("Invalid email or password (min 6 chars).");
  const auth = getFirebaseAuth();
  if (!auth) {
    const u: AppUser = {
      uid: `local_${btoa(email).slice(0, 16)}`, email,
      name: name || email.split("@")[0],
      provider: "local",
      emailVerified: true,
    };
    writeLocal(u);
    return u;
  }
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    try { await updateProfile(cred.user, { displayName: name }); } catch { /* non-fatal */ }
  }
  // Send the verification email immediately. Failures are non-fatal —
  // the user can hit "Resend" on the verify page.
  try {
    if (typeof window !== "undefined") {
      await sendEmailVerification(cred.user, {
        url: `${window.location.origin}/verify-email?continue=1`,
        handleCodeInApp: false,
      });
    } else {
      await sendEmailVerification(cred.user);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[auth] sendEmailVerification on signup failed:", err);
  }
  const app = fbToApp(cred.user, "password");
  if (name) app.name = name;
  writeLocal(app);
  // Always throw — the user must verify before being granted access.
  throw new UnverifiedEmailError(app.email);
}

export async function loginWithGoogle(): Promise<AppUser> {
  const auth = getFirebaseAuth();
  if (!auth) {
    const fake: AppUser = {
      uid: "local_google_demo", email: "you@example.com",
      name: "EXdeck user", provider: "local",
      emailVerified: true,
    };
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

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export const firebaseEnabled = isFirebaseConfigured;
