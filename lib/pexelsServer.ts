/**
 * Server-side Pexels search used during deck generation to resolve the
 * model's image search queries into real image URLs. Reads PEXELS_API_KEY
 * directly (server env) — never exposed to the client.
 */

export type StockImage = {
  url: string;        // a good-quality src (large)
  width: number;
  height: number;
  alt: string;
  photographer: string;
};

/** Search Pexels and return the top results. Returns [] when unconfigured
 *  or on any error, so generation never fails because of images. */
export async function searchStockImages(
  query: string,
  opts?: { perPage?: number; orientation?: "landscape" | "portrait" | "square" },
): Promise<StockImage[]> {
  const key = process.env.PEXELS_API_KEY;
  const q = (query || "").trim();
  if (!key || !q) return [];
  try {
    const params = new URLSearchParams({
      query: q,
      per_page: String(Math.min(20, Math.max(1, opts?.perPage ?? 5))),
      page: "1",
    });
    if (opts?.orientation) params.set("orientation", opts.orientation);
    const res = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
      headers: { Authorization: key },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const photos: any[] = Array.isArray(data?.photos) ? data.photos : [];
    return photos.map((p) => ({
      url: p?.src?.large || p?.src?.large2x || p?.src?.medium || p?.src?.original || "",
      width: Number(p?.width) || 0,
      height: Number(p?.height) || 0,
      alt: typeof p?.alt === "string" ? p.alt : "",
      photographer: typeof p?.photographer === "string" ? p.photographer : "",
    })).filter((p) => p.url);
  } catch {
    return [];
  }
}

/** Resolve a single best image for a query. */
export async function topStockImage(
  query: string,
  orientation?: "landscape" | "portrait" | "square",
): Promise<StockImage | null> {
  const list = await searchStockImages(query, { perPage: 3, orientation });
  return list[0] || null;
}
