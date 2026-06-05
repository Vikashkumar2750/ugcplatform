/**
 * Reads encrypted API keys from browser localStorage.
 * Keys are stored as base64-encoded JSON under "ugc_keys".
 */
export function getApiKeys(): { anthropic: string; apify: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ugc_keys");
    if (!raw) return null;
    const decoded = JSON.parse(atob(raw));
    return decoded;
  } catch {
    return null;
  }
}

export function hasApiKeys(): boolean {
  const keys = getApiKeys();
  return !!(keys?.anthropic && keys?.apify);
}
