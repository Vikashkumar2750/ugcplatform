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
    let reach7d = 0, reachPrev7d = 0, impressions7d = 0, impressionsPrev7d = 0, engaged7d = 0, engagedPrev7d = 0;
    let fanGrowthChart: { date: string; fans: number }[] | null = null;

    try {
      const { data: insData } = await metaFetch(
        `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_impressions,page_reach,page_views_total,page_engaged_users,page_fans&period=day&since=${since}&until=${until}&access_token=${token}`,
        { cacheKey: `${cachePrefix}:insights`, cacheTtlMs: 60 * 60 * 1000, tokenId }
      );
      for (const m of (insData?.data || [])) {
        const vals = m.values || [];
        const total = vals.reduce((s: number, v: any) => s + (v.value || 0), 0);
        const l7 = vals.slice(-7).reduce((s: number, v: any) => s + (v.value || 0), 0);
        const p7 = vals.slice(-14, -7).reduce((s: number, v: any) => s + (v.value || 0), 0);

        if (m.name === "page_reach") { totalReach = total; reach7d = l7; reachPrev7d = p7; }
        if (m.name === "page_impressions") { totalImpressions = total; impressions7d = l7; impressionsPrev7d = p7; }
        if (m.name === "page_views_total") totalViews = total;
        if (m.name === "page_engaged_users") { totalEngaged = total; engaged7d = l7; engagedPrev7d = p7; }
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

    const now = Date.now();
    const posts7d = posts.filter(p => now - new Date(p.created_time).getTime() < 7 * 86400 * 1000);
    const postsPrev7d = posts.filter(p => {
      const age = now - new Date(p.created_time).getTime();
      return age >= 7 * 86400 * 1000 && age < 14 * 86400 * 1000;
    });

    const avgLikes7d = posts7d.length ? Math.round(posts7d.reduce((s, p) => s + (p.likes?.summary?.total_count || 0), 0) / posts7d.length) : 0;
    const avgComments7d = posts7d.length ? Math.round(posts7d.reduce((s, p) => s + (p.comments?.summary?.total_count || 0), 0) / posts7d.length) : 0;
    const avgLikesPrev7d = postsPrev7d.length ? Math.round(postsPrev7d.reduce((s, p) => s + (p.likes?.summary?.total_count || 0), 0) / postsPrev7d.length) : 0;
    const avgCommentsPrev7d = postsPrev7d.length ? Math.round(postsPrev7d.reduce((s, p) => s + (p.comments?.summary?.total_count || 0), 0) / postsPrev7d.length) : 0;
    const er7d = fans > 0 ? parseFloat(((engaged7d / fans) * 100).toFixed(2)) : 0;
    const erPrev7d = fans > 0 ? parseFloat(((engagedPrev7d / fans) * 100).toFixed(2)) : 0;

    const pct = (curr: number, prev: number) => prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);

    const comparison7d = {
      reach:       { current: reach7d, previous: reachPrev7d, pct: pct(reach7d, reachPrev7d) },
      impressions: { current: impressions7d, previous: impressionsPrev7d, pct: pct(impressions7d, impressionsPrev7d) },
      likes:       { current: avgLikes7d, previous: avgLikesPrev7d, pct: pct(avgLikes7d, avgLikesPrev7d) },
      comments:    { current: avgComments7d, previous: avgCommentsPrev7d, pct: pct(avgComments7d, avgCommentsPrev7d) },
      posts:       { current: posts7d.length, previous: postsPrev7d.length, pct: pct(posts7d.length, postsPrev7d.length) },
      er:          { current: er7d, previous: erPrev7d, pct: pct(er7d, erPrev7d) },
    };

    // ── 8. Calculate Deterministic Scores ────────────────────────
    let consistencyScore = 40;
    if (posts.length >= 15) consistencyScore = 100;
    else if (posts.length >= 8) consistencyScore = 80;
    else if (posts.length >= 4) consistencyScore = 60;

    let engagementScore = 40;
    const er = parseFloat(engagementRate);
    if (er >= 5) engagementScore = 100;
    else if (er >= 3) engagementScore = 80;
    else if (er >= 1.5) engagementScore = 60;

    let growthScore = 50;
    const reachPct = comparison7d.reach.pct || 0;
    if (reachPct >= 20) growthScore = 100;
    else if (reachPct >= 5) growthScore = 80;
    else if (reachPct >= -5) growthScore = 60;
    else if (reachPct >= -20) growthScore = 40;
    else growthScore = 20;

    let contentScore = 50;
    if (topPosts.length > 0 && typeof topPosts[0] === 'object' && 'er' in topPosts[0]) {
      const topEr = parseFloat((topPosts[0] as any).er || "0");
      if (topEr >= 8) contentScore = 100;
      else if (topEr >= 5) contentScore = 80;
      else if (topEr >= 3) contentScore = 60;
      else if (topEr >= 1) contentScore = 40;
      else contentScore = 20;
    }

    const healthScore = Math.round((consistencyScore + engagementScore + growthScore + contentScore) / 4);
    const scores = { healthScore, growthScore, engagementScore, contentScore, consistencyScore };

    let aiData = null;

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
      posts7dCount: posts7d.length,
      posts30dCount: posts.length, // approximation for 30d
      avgLikes: posts.length ? Math.round(posts.reduce((s, p) => s + (p.likes?.summary?.total_count || 0), 0) / posts.length) : 0,
      avgComments: posts.length ? Math.round(posts.reduce((s, p) => s + (p.comments?.summary?.total_count || 0), 0) / posts.length) : 0,
      ...scores,
      comparison7d,
      topPosts,
      fanGrowthChart: fanGrowthChart && fanGrowthChart.length > 1 ? fanGrowthChart : null,
      accountType: account.account_type || "Page",
      connectedAt: account.connected_at,
      availableAccounts,
      aiData,
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
