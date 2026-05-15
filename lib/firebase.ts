/**
 * Firebase initialization (client-side).
 *
 * The web SDK config values are public by design — they only identify the
 * project, not authorize access. Real protection comes from:
 *   1. Authorized domains in Firebase Console > Authentication > Settings
 *   2. Realtime Database security rules
 *
 * We still load the config from NEXT_PUBLIC_ env vars so it's not hardcoded
 * in source and is easy to rotate.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

const config = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Database | null = null;

export function isFirebaseConfigured(): boolean {
  return !!(config.apiKey && config.projectId && config.appId && config.databaseURL);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (!isFirebaseConfigured()) return null;
  if (_app) return _app;
  _app = getApps()[0] || initializeApp(config as any);
  return _app;
}

export function getFirebaseAuth(): Auth | null {
  if (_auth) return _auth;
  const app = getFirebaseApp();
  if (!app) return null;
  _auth = getAuth(app);
  return _auth;
}

export function getFirebaseDb(): Database | null {
  if (_db) return _db;
  const app = getFirebaseApp();
  if (!app) return null;
  _db = getDatabase(app);
  return _db;
}
