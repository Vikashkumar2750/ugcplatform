/**
 * lib/meta-rate-limit.ts
 *
 * Meta Graph API rate limit handler per official docs:
 * https://developers.facebook.com/docs/graph-api/overview/rate-limiting
 *
 * Implements:
 * - X-App-Usage header parsing (call_count, total_cputime, total_time)
 * - In-memory cache per token (avoids redundant calls in 30min window)
 * - Automatic backoff when >80% limit used
 * - Error code detection (4, 17, 32, 613)
 */

// ── In-memory cache (resets on cold start) ────────────────────────
interface CacheEntry {
  data: any;
  cachedAt: number;
  ttlMs: number;
}

const memCache = new Map<string, CacheEntry>();

// ── Rate limit state tracker ──────────────────────────────────────
interface RateLimitState {
  callCount: number;      // % of hourly quota used
  totalCpuTime: number;   // % of CPU time used
  totalTime: number;      // % of total time used
  checkedAt: number;
}
const rateLimitState = new Map<string, RateLimitState>();

// ── Meta error codes that indicate rate limiting ──────────────────
export const META_RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

/**
 * Parse X-App-Usage or X-Business-Use-Case-Usage header
 */
export function parseUsageHeader(headers: Headers): RateLimitState | null {
  const raw = headers.get("x-app-usage") || headers.get("x-business-use-case-usage");
  if (!raw) return null;
  try {
    // x-business-use-case-usage is nested per BUC type
    const parsed = JSON.parse(raw);
    // Platform rate limit format
    if ("call_count" in parsed) {
      return {
        callCount: parsed.call_count || 0,
        totalCpuTime: parsed.total_cputime || 0,
        totalTime: parsed.total_time || 0,
        checkedAt: Date.now(),
      };
    }
    // BUC format — find highest usage across all BUCs
    let maxCallCount = 0;
    for (const bucEntries of Object.values(parsed)) {
      if (Array.isArray(bucEntries)) {
        for (const entry of bucEntries as any[]) {
          maxCallCount = Math.max(maxCallCount, entry.call_count || 0);
        }
      }
    }
    return {
      callCount: maxCallCount,
      totalCpuTime: 0,
      totalTime: 0,
      checkedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Check if Meta API error response is a rate limit error
 */
export function isRateLimitError(errorCode: number): boolean {
  return META_RATE_LIMIT_CODES.has(errorCode);
}

/**
 * Get cache key
 */
function cacheKey(namespace: string, ...parts: string[]): string {
  return `${namespace}:${parts.join(":")}`;
}

/**
 * Get cached value if not expired
 */
export function getCache<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > entry.ttlMs) {
    memCache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Set cache value
 */
export function setCache(key: string, data: any, ttlMs = 30 * 60 * 1000): void {
  memCache.set(key, { data, cachedAt: Date.now(), ttlMs });
}

/**
 * Wrapped fetch for Meta Graph API that:
 * 1. Checks cache first
 * 2. Reads X-App-Usage from response headers
 * 3. Warns when >80% rate limit used
 * 4. Detects rate limit error codes in response body
 */
export async function metaFetch(
  url: string,
  options: {
    cacheKey?: string;
    cacheTtlMs?: number;
    tokenId?: string; // for per-token rate limit tracking
  } = {}
): Promise<{ data: any; fromCache: boolean; rateLimit: RateLimitState | null }> {
  const ck = options.cacheKey;

  // 1. Check cache
  if (ck) {
    const cached = getCache<any>(ck);
    if (cached !== null) {
      return { data: cached, fromCache: true, rateLimit: null };
    }
  }

  // 2. Check current rate limit state for this token
  const tokenId = options.tokenId || "default";
  const currentState = rateLimitState.get(tokenId);
  if (currentState) {
    const isStale = Date.now() - currentState.checkedAt > 5 * 60 * 1000; // 5 min
    if (!isStale && currentState.callCount >= 90) {
      console.warn(`[MetaAPI] Rate limit at ${currentState.callCount}% — using cache only`);
      // Return cached data even if slightly stale when near limit
      if (ck) {
        const stale = memCache.get(ck);
        if (stale) return { data: stale.data, fromCache: true, rateLimit: currentState };
      }
      throw new Error(`Rate limit at ${currentState.callCount}%. Please wait and retry.`);
    }
  }

  // 3. Make the API call
  const res = await fetch(url);
  const data = await res.json();

  // 4. Parse rate limit headers
  const rateLimit = parseUsageHeader(res.headers);
  if (rateLimit && options.tokenId) {
    rateLimitState.set(options.tokenId, rateLimit);
    if (rateLimit.callCount >= 80) {
      console.warn(
        `[MetaAPI] ⚠️ Rate limit at ${rateLimit.callCount}% — reduce API calls or implement longer cache`
      );
    }
  }

  // 5. Check for rate limit errors in response body
  if (data?.error) {
    const code = data.error.code;
    if (isRateLimitError(code)) {
      console.error(`[MetaAPI] Rate limit error code ${code}: ${data.error.message}`);
      // Return cached data if available
      if (ck) {
        const stale = memCache.get(ck);
        if (stale) {
          console.log("[MetaAPI] Serving stale cache due to rate limit");
          return { data: stale.data, fromCache: true, rateLimit };
        }
      }
      throw new Error(`Meta API rate limited (code ${code}). Please wait before retrying.`);
    }
  }

  // 6. Store in cache
  if (ck && !data?.error) {
    setCache(ck, data, options.cacheTtlMs || 30 * 60 * 1000);
  }

  return { data, fromCache: false, rateLimit };
}

/**
 * Clear all caches for a specific token/user (e.g., on disconnect)
 */
export function clearMetaCache(prefix: string): void {
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key);
  }
}
