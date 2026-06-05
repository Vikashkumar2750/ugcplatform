/**
 * lib/insights-cache.ts
 *
 * Daily insights cache using Supabase.
 * - Data is refreshed ONCE per day (IST midnight boundary).
 * - Manual refresh (force=true) always bypasses cache.
 * - In-memory cache (metaFetch 30min) still works as a secondary layer.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// IST is UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function fetchedDateIST(timestamptz: string): string {
  return new Date(new Date(timestamptz).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Check if cached insights data is still valid for today (IST).
 * Returns cached data if fresh, null if needs refresh.
 */
export async function getDailyCache(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  force = false
): Promise<{ data: any; fromCache: boolean } | null> {
  if (force) return null; // manual refresh always bypasses

  const { data: cache } = await supabase
    .from("insights_cache")
    .select("data, fetched_at")
    .eq("user_id", userId)
    .eq("platform", platform)
    .single();

  if (!cache) return null;

  const isToday = fetchedDateIST(cache.fetched_at) === todayIST();
  if (!isToday) return null;

  return { data: cache.data, fromCache: true };
}

/**
 * Store fresh insights data in cache (upsert by user+platform).
 */
export async function setDailyCache(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  data: any
): Promise<void> {
  await supabase.from("insights_cache").upsert(
    { user_id: userId, platform, data, fetched_at: new Date().toISOString() },
    { onConflict: "user_id,platform" }
  );
}
