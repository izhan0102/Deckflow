import { NextRequest } from "next/server";

type RateLimitRecord = {
  timestamps: number[];
};

const tracker = new Map<string, RateLimitRecord>();

// Periodically clean up tracker map to avoid memory leaks
if (typeof global !== "undefined") {
  const g = global as any;
  if (!g.rateLimitInterval) {
    g.rateLimitInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of tracker.entries()) {
        record.timestamps = record.timestamps.filter((ts) => now - ts < 300000); // Keep last 5 minutes
        if (record.timestamps.length === 0) {
          tracker.delete(key);
        }
      }
    }, 60000); // Clean up every 1 minute
  }
}

export function isRateLimited(req: NextRequest, limit: number, windowMs: number): boolean {
  // Try to get IP address
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ||
             req.headers.get("x-real-ip") ||
             "127.0.0.1";

  const now = Date.now();
  let record = tracker.get(ip);
  if (!record) {
    record = { timestamps: [] };
    tracker.set(ip, record);
  }

  // Keep only timestamps within the sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limit) {
    return true;
  }

  record.timestamps.push(now);
  return false;
}
