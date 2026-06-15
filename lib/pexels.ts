import { getIdToken } from "./auth";

/** A Pexels photo (subset of the API response we use). */
export type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt: string;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
};

export type PexelsOrientation = "" | "landscape" | "portrait" | "square";

/**
 * Search Pexels via our authenticated proxy. Returns [] for empty queries
 * or on error (callers can surface a friendlier message from the throw).
 */
export async function searchPexels(
  query: string,
  opts?: { perPage?: number; page?: number; orientation?: PexelsOrientation },
): Promise<PexelsPhoto[]> {
  const q = (query || "").trim();
  if (!q) return [];
  const token = await getIdToken();
  const params = new URLSearchParams({
    q,
    per_page: String(opts?.perPage ?? 24),
    page: String(opts?.page ?? 1),
  });
  if (opts?.orientation) params.set("orientation", opts.orientation);

  const res = await fetch(`/api/pexels?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Image search failed.");
  }
  const data = await res.json();
  return Array.isArray(data?.photos) ? (data.photos as PexelsPhoto[]) : [];
}
