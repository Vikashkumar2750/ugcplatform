import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { metaFetch } from "@/lib/meta-rate-limit";
import { getDailyCache, setDailyCache } from "@/lib/insights-cache";

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "true";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accountId = request.nextUrl.searchParams.get("accountId");

    const { data: accounts } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", "facebook")
      .eq("is_active", true)
      .order("connected_at", { ascending: false });

    if (!accounts || accounts.length === 0) return NextResponse.json({ error: "not_connected" }, { status: 404 });

    const account = accountId ? accounts.find(a => a.id === accountId) || accounts[0] : accounts[0];
    
    const availableAccounts = accounts.map(a => ({
      id: a.id,
      name: a.platform_name || "Facebook Page",
      handle: a.platform_username || "",
    }));

    // ── Daily cache check ──
    const cached = await getDailyCache(supabase, user.id, `facebook_${account.id}`, force);
    if (cached) {
      console.log("[FB Insights] Serving daily cache from Supabase");
      return NextResponse.json({ ...cached.data, accountId: account.id, availableAccounts, _fromCache: true });
    }

    const pageId = account.platform_user_id;
    const token = account.access_token;
    const tokenId = `fb:${account.id}`;
    const cachePrefix = `fb:${account.id}`;

    // ── 1. Page Info (cached 30min) ───────────────────────────────
    const { data: page } = await metaFetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=id,name,fan_count,followers_count,category,about,website&access_token=${token}`,
      { cacheKey: `${cachePrefix}:page`, cacheTtlMs: 30 * 60 * 1000, tokenId }
    );

    if (page?.error) {
      const code = page.error.code;
      return NextResponse.json({
        error: code === 190 ? "Access token expired — reconnect Facebook" : page.error.message,
        code,
      }, { status: 400 });
    }

    // ── 2. Page Insights — single combined call (cached 1hr) ──────
    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const until = Math.floor(Date.now() / 1000);
    let totalReach = 0, totalImpressions = 0, totalViews = 0, totalEngaged = 0;
    let fanGrowthChart: { date: string; fans: number }[] | null = null;

    try {
      const { data: insData } = await metaFetch(
        `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_impressions,page_reach,page_views_total,page_engaged_users,page_fans&period=day&since=${since}&until=${until}&access_token=${token}`,
        { cacheKey: `${cachePrefix}:insights`, cacheTtlMs: 60 * 60 * 1000, tokenId }
      );
      for (const m of (insData?.data || [])) {
        const total = (m.values || []).reduce((s: number, v: any) => s + (v.value || 0), 0);
        if (m.name === "page_reach") totalReach = total;
        if (m.name === "page_impressions") totalImpressions = total;
        if (m.name === "page_views_total") totalViews = total;
        if (m.name === "page_engaged_users") totalEngaged = total;
        if (m.name === "page_fans" && m.values?.length > 1) {
          fanGrowthChart = m.values
            .filter((_: any, i: number) => i % 5 === 0)
            .map((v: any) => ({
              date: new Date(v.end_time).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
              fans: v.value,
            }));
        }
      }
    } catch (e: any) {
      console.warn("[FB Insights] insights failed:", e.message);
    }

    // ── 3. Recent Posts (cached 15min) ────────────────────────────
    let posts: any[] = [];
    try {
      const { data: postsData } = await metaFetch(
        `https://graph.facebook.com/v21.0/${pageId}/published_posts?fields=id,message,story,created_time,attachments{type},likes.summary(true),comments.summary(true),shares&limit=15&access_token=${token}`,
        { cacheKey: `${cachePrefix}:posts`, cacheTtlMs: 15 * 60 * 1000, tokenId }
      );
      posts = postsData?.data || [];
    } catch {}

    const topPosts = posts.slice(0, 5).map((post: any) => ({
      id: post.id,
      message: (post.message || post.story || "Post")?.substring(0, 100),
      type: post.attachments?.data?.[0]?.type || "status",
      likes: post.likes?.summary?.total_count || 0,
      comments: post.comments?.summary?.total_count || 0,
      shares: post.shares?.count || 0,
      created: post.created_time,
    }));

    const fans = page.fan_count || page.followers_count || 0;
    const engagementRate = fans > 0 && totalEngaged > 0
      ? ((totalEngaged / fans) * 100).toFixed(2) : "0.00";

    const responseData = {
      connected: true,
      accountId: account.id,
      pageName: page.name || account.platform_name,
      pageId,
      fans,
      followers: page.followers_count || fans,
      category: page.category || "Page",
      totalReach,
      totalImpressions,
      totalViews,
      totalEngaged,
      engagementRate: parseFloat(engagementRate),
      postsCount: posts.length,
      topPosts,
      fanGrowthChart: fanGrowthChart && fanGrowthChart.length > 1 ? fanGrowthChart : null,
      accountType: account.account_type || "Page",
      connectedAt: account.connected_at,
      availableAccounts,
    };
    await setDailyCache(supabase, user.id, `facebook_${account.id}`, responseData);
    return NextResponse.json({ ...responseData, _fromCache: false, _fetchedAt: new Date().toISOString() });

  } catch (err: any) {
    console.error("[/api/insights/facebook]", err.message);
    if (err.message?.includes("Rate limit") || err.message?.includes("rate limit")) {
      return NextResponse.json({ error: err.message, retryAfter: 3600 }, { status: 429 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
