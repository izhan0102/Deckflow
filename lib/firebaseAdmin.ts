import * as admin from "firebase-admin";

if (!admin.apps.length && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  try {
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

export async function verifyToken(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Local fallback mode when Firebase env vars are missing
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      return "local_dev_user";
    }
    return null;
  }

  const token = authHeader.substring(7);

  // If token is local dummy token, and Firebase is not configured, bypass
  if (token.startsWith("local_") && !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    return token;
  }

  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    return "local_dev_user";
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch (err) {
    console.error("Firebase ID token verification failed:", err);
    return null;
  }
}
