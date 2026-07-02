import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/connect/check-limit?platform=instagram
 * Returns whether the user can connect another account for this platform.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ allowed: false, reason: "Not logged in" }, { status: 401 });

    const platform = request.nextUrl.searchParams.get("platform");
    if (!platform) return NextResponse.json({ error: "platform param required" }, { status: 400 });

    // Count active accounts for this platform
    const { count, error } = await supabase
      .from("connected_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("platform", platform)
      .eq("is_active", true);

    if (error) throw error;
    const currentCount = count || 0;

    // Get user's max from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("max_accounts_per_platform, subscription_tier, subscription_expires_at")
      .eq("id", user.id)
      .single();

    let maxAllowed = profile?.max_accounts_per_platform || 1;
    const tier = profile?.subscription_tier || "free";

    // Check if subscription expired
    if (tier === "pro" && profile?.subscription_expires_at) {
      const expiresAt = new Date(profile.subscription_expires_at).getTime();
      if (expiresAt < Date.now()) {
        // Expired — revert to free tier limits
        maxAllowed = 1;
      }
    }

    const allowed = currentCount < maxAllowed;

    return NextResponse.json({
      allowed,
      current: currentCount,
      max: maxAllowed,
      tier,
      upgradeRequired: !allowed && tier === "free",
      expiresAt: profile?.subscription_expires_at || null,
    });
  } catch (err: any) {
    console.error("[check-limit]", err.message);
    return NextResponse.json({ allowed: true, current: 0, max: 1, tier: "free" });
  }
}
