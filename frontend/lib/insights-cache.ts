/**
 * insights-cache.ts
 * Daily cache for Meta insights data stored in Supabase.
 * Prevents hitting Meta API rate limits by caching responses once per day (IST).
 */

import { SupabaseClient } from "@supabase/supabase-js";

function getTodayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
}

export async function getDailyCache(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  force = false
): Promise<{ data: any } | null> {
  if (force) return null;

  const today = getTodayIST();
  const { data } = await supabase
    .from("insights_daily_cache")
    .select("data")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("cache_date", today)
    .maybeSingle();

  return data || null;
}

export async function setDailyCache(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  responseData: any
): Promise<void> {
  const today = getTodayIST();
  await supabase.from("insights_daily_cache").upsert({
    user_id: userId,
    platform,
    cache_date: today,
    data: responseData,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,platform,cache_date" });
}
