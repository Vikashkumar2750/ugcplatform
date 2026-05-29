import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get connected Facebook account from DB
    const { data: account } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", "facebook")
      .eq("is_active", true)
      .single();

    if (!account) return NextResponse.json({ error: "not_connected" }, { status: 404 });

    const pageId = account.platform_user_id;
    const token = account.access_token;

    // ── 1. Page Basic Info ────────────────────────────────────────
    const pageRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=id,name,fan_count,followers_count,category,about,website&access_token=${token}`
    );
    const page = await pageRes.json();

    // ── 2. Page Insights (reach, impressions, views) ─────────────
    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const until = Math.floor(Date.now() / 1000);
    let totalReach = 0, totalImpressions = 0, totalViews = 0, totalEngaged = 0;

    try {
      const insRes = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_impressions,page_reach,page_views_total,page_engaged_users&period=day&since=${since}&until=${until}&access_token=${token}`
      );
      const insData = await insRes.json();
      for (const m of (insData.data || [])) {
        const total = (m.values || []).reduce((s: number, v: any) => s + (v.value || 0), 0);
        if (m.name === "page_reach") totalReach = total;
        if (m.name === "page_impressions") totalImpressions = total;
        if (m.name === "page_views_total") totalViews = total;
        if (m.name === "page_engaged_users") totalEngaged = total;
      }
    } catch {}

    // ── 3. Recent Posts with Engagement (single call) ─────────────
    let posts: any[] = [];
    try {
      const postsRes = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/published_posts?fields=id,message,story,created_time,attachments{type},likes.summary(true),comments.summary(true),shares&limit=20&access_token=${token}`
      );
      const postsData = await postsRes.json();
      posts = postsData.data || [];
    } catch {}

    // ── 4. Build top posts from combined data ─────────────────────
    const topPosts: any[] = posts.slice(0, 5).map((post: any) => ({
      id: post.id,
      message: (post.message || post.story || "Post")?.substring(0, 80),
      type: post.attachments?.data?.[0]?.type || "status",
      likes: post.likes?.summary?.total_count || 0,
      comments: post.comments?.summary?.total_count || 0,
      shares: post.shares?.count || 0,
      created: post.created_time,
    }));

    // ── 5. Fan growth (last 30 days) ──────────────────────────────
    let fanGrowthChart: { date: string; fans: number }[] = [];
    try {
      const fgRes = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_fans&period=day&since=${since}&until=${until}&access_token=${token}`
      );
      const fgData = await fgRes.json();
      const fanMetric = fgData.data?.find((d: any) => d.name === "page_fans");
      if (fanMetric?.values?.length) {
        fanGrowthChart = fanMetric.values
          .filter((_: any, i: number) => i % 5 === 0)
          .map((v: any) => ({
            date: new Date(v.end_time).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
            fans: v.value,
          }));
      }
    } catch {}

    const fans = page.fan_count || page.followers_count || 0;
    const engagementRate = fans > 0 && totalEngaged > 0
      ? ((totalEngaged / fans) * 100).toFixed(2)
      : "0.00";

    return NextResponse.json({
      connected: true,
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
      fanGrowthChart: fanGrowthChart.length > 0 ? fanGrowthChart : null,
      connectedAt: account.connected_at,
    });

  } catch (err: any) {
    console.error("[/api/insights/facebook]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
