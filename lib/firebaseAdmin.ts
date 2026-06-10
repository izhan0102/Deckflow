import { type NextRequest } from "next/server";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let _app: App | undefined;

// Init Firebase Admin using a base64 encoded service account JSON key
function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!encoded) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set.");
  }

  try {
    const serviceAccount = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf-8")
    );
    _app = initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
    return _app;
  } catch {
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY.");
  }
}

/** Exposed so server-only helpers (plan/usage enforcement) can reach RTDB. */
export function getAdminAppOrThrow(): App {
  return getAdminApp();
}

// Verifies Bearer token and returns the user's uid
export async function authenticateRequest(req: NextRequest): Promise<string> {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new AuthError("Missing or malformed Authorization header", 401);
  }

  const idToken = header.slice(7).trim();
  if (!idToken) {
    throw new AuthError("Empty Bearer token", 401);
  }

  try {
    getAdminApp();
    const decoded = await getAuth().verifyIdToken(idToken);
    // Hard block unverified emails so they can't bypass the UI gate.
    if (!decoded.email_verified) {
      throw new AuthError("Email not verified", 403);
    }
    return decoded.uid;
  } catch (err: any) {
    // Our own AuthError (e.g. the 403 above) is already well-formed —
    // re-throw it as-is so the caller sees the correct status. Only wrap
    // genuine token-verification failures from the Firebase SDK below.
    if (err instanceof AuthError) throw err;
    // Surface a useful message instead of "(unknown)". Common causes:
    //  - FIREBASE_SERVICE_ACCOUNT_KEY missing or malformed (init throws)
    //  - Service account belongs to a different Firebase project than
    //    the client app (token's audience mismatch)
    //  - Token expired or revoked
    const detail =
      err?.code ||
      (typeof err?.message === "string" ? err.message : "") ||
      err?.name ||
      "unknown";
    // eslint-disable-next-line no-console
    console.error("[firebaseAdmin] verifyIdToken failed:", err);
    throw new AuthError(`Token verification failed (${detail})`, 401);
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
