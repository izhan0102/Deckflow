import Groq from "groq-sdk";

/**
 * Returns the ordered list of available Groq API keys: primary first,
 * then any GROQ_API_KEY_FALLBACK / _FALLBACK_2 / _FALLBACK_3 ... entries.
 */
function loadKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.GROQ_API_KEY;
  if (primary) keys.push(primary);

  // GROQ_API_KEY_FALLBACK, GROQ_API_KEY_FALLBACK_2, ...
  const fallback = process.env.GROQ_API_KEY_FALLBACK;
  if (fallback) keys.push(fallback);
  for (let i = 2; i < 10; i++) {
    const k = process.env[`GROQ_API_KEY_FALLBACK_${i}`];
    if (k) keys.push(k);
  }
  return Array.from(new Set(keys.filter(Boolean)));
}

/** Status codes Groq returns for "this key is exhausted, try another". */
const FALLBACK_STATUSES = new Set([401, 403, 413, 429, 500, 502, 503, 504]);

function shouldFallback(err: any): boolean {
  if (!err) return false;
  const status = Number(err.status ?? err.statusCode);
  if (FALLBACK_STATUSES.has(status)) return true;
  // Groq SDK sometimes packs the message instead of status.
  const msg = String(err?.message || err?.error?.message || "").toLowerCase();
  return /rate.?limit|quota|too.large|insufficient|unauthorized|invalid.api.key/.test(msg);
}

/**
 * Run a Groq SDK call with automatic key rotation. Each callback receives
 * a fresh `Groq` instance and the (1-based) attempt number.
 *
 * Throws the last error if every key fails.
 */
export async function withGroqClient<T>(
  fn: (client: Groq, attempt: number) => Promise<T>,
): Promise<T> {
  const keys = loadKeys();
  if (keys.length === 0) {
    throw new Error("GROQ_API_KEY is not set. Add it to .env.local");
  }
  let lastErr: any = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const client = new Groq({ apiKey: key });
      return await fn(client, i + 1);
    } catch (err: any) {
      lastErr = err;
      if (i === keys.length - 1 || !shouldFallback(err)) {
        // Either we've exhausted fallbacks or the error isn't retryable.
        throw err;
      }
      // Log and try the next key.
      // eslint-disable-next-line no-console
      console.warn(
        `[groq] key #${i + 1} failed (${err?.status || err?.statusCode || "?"}); falling back to key #${i + 2}`,
      );
    }
  }
  throw lastErr;
}
