/**
 * insights-cache.ts
 * Cache for Meta insights data stored in Supabase.
 * Prevents hitting Meta API rate limits by caching responses per account for 24 hours.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export async function getDailyCache(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  force = false
): Promise<{ data: any } | null> {
  if (force) return null;

  const { data } = await supabase
    .from("insights_cache")
    .select("data, fetched_at")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();

  if (data && data.fetched_at) {
    const fetchTime = new Date(data.fetched_at).getTime();
    const now = Date.now();
    // Cache is valid for 24 hours (86400000 ms)
    if (now - fetchTime < 86400000) {
      return { data: data.data };
    }
  }

  return null;
}

export async function setDailyCache(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  responseData: any
): Promise<void> {
  await supabase.from("insights_cache").upsert({
    user_id: userId,
    platform,
    data: responseData,
    fetched_at: new Date().toISOString(),
  }, { onConflict: "user_id,platform" });
}
