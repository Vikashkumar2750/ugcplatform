export async function fetchWithCache(url: string, options?: RequestInit, ttl: number = 86400000) {
  const cacheKey = `ce_cache_${url}_${JSON.stringify(options || {})}`;

  // Try localStorage
  try {
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.expiry > Date.now()) {
        return parsed.data;
      } else {
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (e) {
    // ignore localStorage errors
  }

  // Fetch from network
  const res = await fetch(url, options);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch ${url}`);
  }
  
  const data = await res.json();
  
  // Save to localStorage
  try {
    const cacheData = { data, expiry: Date.now() + ttl };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (e) {
    // ignore quota exceeded or other errors
  }
  
  return data;
}
