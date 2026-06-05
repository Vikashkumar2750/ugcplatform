/**
 * meta-rate-limit.ts
 * Thin wrapper around fetch for Meta Graph API with in-memory caching.
 * Prevents hammering the API on repeated requests within the same process.
 */

interface CacheEntry {
  data: any;
  expiresAt: number;
}

// In-memory cache (per Vercel serverless instance)
const memCache = new Map<string, CacheEntry>();

interface MetaFetchOptions {
  cacheKey?: string;
  cacheTtlMs?: number;
  tokenId?: string;
}

export async function metaFetch(
  url: string,
  options: MetaFetchOptions = {}
): Promise<{ data: any; fromCache: boolean }> {
  const { cacheKey, cacheTtlMs = 5 * 60 * 1000 } = options;

  // Check memory cache
  if (cacheKey) {
    const cached = memCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { data: cached.data, fromCache: true };
    }
  }

  const res = await fetch(url);
  const data = await res.json();

  // Cache successful responses
  if (cacheKey && res.ok) {
    memCache.set(cacheKey, { data, expiresAt: Date.now() + cacheTtlMs });
  }

  return { data, fromCache: false };
}
