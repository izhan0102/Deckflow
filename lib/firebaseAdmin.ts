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
    _app = initializeApp({ credential: cert(serviceAccount as any) });
    return _app;
  } catch {
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY.");
  }
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
    return decoded.uid;
  } catch (err: any) {
    throw new AuthError(`Token verification failed (${err?.code || "unknown"})`, 401);
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
