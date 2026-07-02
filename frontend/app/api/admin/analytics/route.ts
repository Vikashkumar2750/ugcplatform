import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/admin/analytics
 * Returns real-time analytics from the database
 */
export async function GET(request: NextRequest) {
  try {
    // Admin auth check
    const adminPw = request.cookies.get("admin_session")?.value;
    if (!adminPw) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceClient();

    // Run all queries in parallel
    const [
      usersResult,
      accountsResult,
      analysesResult,
      rulesResult,
      nicheResult,
    ] = await Promise.all([
      // Total users
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      // Connected accounts by platform
      supabase.from("connected_accounts").select("platform, user_id").eq("is_active", true),
      // Total analyses
      supabase.from("analyses").select("id, user_id, platform", { count: "exact" }),
      // Automation rules
      supabase.from("automation_rules").select("id, is_active", { count: "exact" }),
      // Niche distribution
      supabase.from("profiles").select("niche"),
    ]);

    // Platform stats
    const accounts = accountsResult.data || [];
    const analyses = analysesResult.data || [];
    const platformMap: Record<string, { connected: number; analyses: number }> = {};
    
    const PLATFORM_STYLES: Record<string, { color: string; border: string }> = {
      instagram: { color: "from-pink-500 to-purple-500", border: "border-pink-500/20" },
      facebook: { color: "from-blue-600 to-blue-400", border: "border-blue-500/20" },
      youtube: { color: "from-red-600 to-red-400", border: "border-red-500/20" },
      linkedin: { color: "from-sky-600 to-sky-400", border: "border-sky-500/20" },
    };

    for (const a of accounts) {
      if (!platformMap[a.platform]) platformMap[a.platform] = { connected: 0, analyses: 0 };
      platformMap[a.platform].connected++;
    }
    for (const a of analyses) {
      if (!platformMap[a.platform]) platformMap[a.platform] = { connected: 0, analyses: 0 };
      platformMap[a.platform].analyses++;
    }

    const platformStats = Object.entries(platformMap).map(([platform, stats]) => ({
      platform,
      connected: stats.connected,
      analyses: stats.analyses,
      color: PLATFORM_STYLES[platform]?.color || "from-zinc-500 to-zinc-400",
      border: PLATFORM_STYLES[platform]?.border || "border-zinc-500/20",
    }));

    // Niche stats
    const niches = nicheResult.data || [];
    const nicheMap: Record<string, number> = {};
    for (const p of niches) {
      const n = p.niche || "Not specified";
      nicheMap[n] = (nicheMap[n] || 0) + 1;
    }
    const nicheStats = Object.entries(nicheMap)
      .map(([niche, users]) => ({ niche, users, analyses: 0 }))
      .sort((a, b) => b.users - a.users);

    // Top users by analyses count
    const userAnalysesMap: Record<string, number> = {};
    for (const a of analyses) {
      userAnalysesMap[a.user_id] = (userAnalysesMap[a.user_id] || 0) + 1;
    }
    const topUserIds = Object.entries(userAnalysesMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => id);

    let topUsers: any[] = [];
    if (topUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, niche, subscription_tier, max_accounts_per_platform")
        .in("id", topUserIds);

      const { data: userAccounts } = await supabase
        .from("connected_accounts")
        .select("user_id, platform")
        .in("user_id", topUserIds)
        .eq("is_active", true);

      const userPlatforms: Record<string, string[]> = {};
      const userAccountCounts: Record<string, number> = {};
      for (const a of (userAccounts || [])) {
        if (!userPlatforms[a.user_id]) userPlatforms[a.user_id] = [];
        if (!userPlatforms[a.user_id].includes(a.platform)) userPlatforms[a.user_id].push(a.platform);
        userAccountCounts[a.user_id] = (userAccountCounts[a.user_id] || 0) + 1;
      }

      topUsers = topUserIds.map(id => {
        const profile = (profiles || []).find(p => p.id === id);
        return {
          name: profile?.full_name || "",
          email: profile?.email || id,
          analyses: userAnalysesMap[id] || 0,
          platforms: userPlatforms[id] || [],
          niche: profile?.niche || "",
          tier: profile?.subscription_tier || "free",
          accountsCount: userAccountCounts[id] || 0,
        };
      });
    }

    // Rules stats
    const rules = rulesResult.data || [];
    const activeRules = rules.filter(r => r.is_active).length;

    return NextResponse.json({
      platformStats,
      nicheStats,
      topUsers,
      totals: {
        users: usersResult.count || 0,
        analyses: analysesResult.count || 0,
        connectedAccounts: accounts.length,
        automationRules: rules.length,
        activeRules,
      },
    });
  } catch (err: any) {
    console.error("[admin/analytics]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
