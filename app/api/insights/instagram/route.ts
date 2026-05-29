import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { metaFetch } from "@/lib/meta-rate-limit";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: account } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", "instagram")
      .eq("is_active", true)
      .single();

    if (!account) return NextResponse.json({ error: "not_connected" }, { status: 404 });

    const igId = account.platform_user_id;
    const token = account.access_token;
    const tokenId = `ig:${account.id}`; // per-account rate limit tracking
    const cachePrefix = `ig:${account.id}`;

    // ── 1. Profile (cached 30min) ─────────────────────────────────
    const { data: profile } = await metaFetch(
      `https://graph.facebook.com/v21.0/${igId}?fields=id,username,name,biography,followers_count,follows_count,media_count,website&access_token=${token}`,
      { cacheKey: `${cachePrefix}:profile`, cacheTtlMs: 30 * 60 * 1000, tokenId }
    );

    if (profile?.error) {
      const msg = profile.error.message;
      const code = profile.error.code;
      return NextResponse.json({
        error: code === 190 ? "Access token expired — please reconnect Instagram" : msg,
        code
      }, { status: 400 });
    }

    // ── 2. Recent media (cached 15min) ────────────────────────────
    const { data: mediaData } = await metaFetch(
      `https://graph.facebook.com/v21.0/${igId}/media?fields=id,timestamp,media_type,like_count,comments_count,caption,thumbnail_url,media_url,permalink&limit=20&access_token=${token}`,
      { cacheKey: `${cachePrefix}:media`, cacheTtlMs: 15 * 60 * 1000, tokenId }
    );

    const posts = mediaData?.data || [];

    // ── 3. Per-post insights — max 5 posts only (rate limit safe) ─
    const topPostsRaw = posts
      .sort((a: any, b: any) => ((b.like_count || 0) + (b.comments_count || 0)) - ((a.like_count || 0) + (a.comments_count || 0)))
      .slice(0, 5);

    const postsWithInsights = await Promise.all(
      topPostsRaw.map(async (p: any) => {
        try {
          const { data: pi } = await metaFetch(
            `https://graph.facebook.com/v21.0/${p.id}/insights?metric=saved,reach,impressions,shares&access_token=${token}`,
            { cacheKey: `${cachePrefix}:post:${p.id}`, cacheTtlMs: 60 * 60 * 1000, tokenId }
          );
          const findMetric = (name: string) =>
            pi?.data?.find((m: any) => m.name === name)?.values?.[0]?.value || 0;
          return {
            ...p,
            saves: findMetric("saved"),
            reach_count: findMetric("reach"),
            impressions_count: findMetric("impressions"),
            shares: findMetric("shares"),
          };
        } catch {
          return { ...p, saves: 0, reach_count: 0, impressions_count: 0, shares: 0 };
        }
      })
    );

    // ── 4. Account-level insights (cached 1hr) ────────────────────
    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const until = Math.floor(Date.now() / 1000);
    let reach = 0, impressions = 0, profileViews = 0;
    let followerGrowthChart: { date: string; followers: number }[] | null = null;

    try {
      const { data: insightsData } = await metaFetch(
        `https://graph.facebook.com/v21.0/${igId}/insights?metric=reach,impressions,profile_views,follower_count&period=day&since=${since}&until=${until}&access_token=${token}`,
        { cacheKey: `${cachePrefix}:account_insights`, cacheTtlMs: 60 * 60 * 1000, tokenId }
      );
      if (insightsData?.data) {
        for (const metric of insightsData.data) {
          const total = (metric.values || []).reduce((s: number, v: any) => s + (v.value || 0), 0);
          if (metric.name === "reach") reach = total;
          if (metric.name === "impressions") impressions = total;
          if (metric.name === "profile_views") profileViews = total;
          if (metric.name === "follower_count" && metric.values?.length) {
            followerGrowthChart = metric.values
              .filter((_: any, i: number) => i % 5 === 0)
              .map((v: any) => ({
                date: new Date(v.end_time).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
                followers: v.value,
              }));
          }
        }
      }
    } catch (e: any) {
      console.warn("[IG Insights] Account insights failed:", e.message);
    }

    // ── Audience demographics (cached 24hr) ───────────────────────
    let demographics = {
      ageRanges: [] as { range: string; pct: number }[],
      topLocations: [] as string[],
      genderSplit: { male: 50, female: 50 },
    };
    try {
      const { data: demoData } = await metaFetch(
        `https://graph.facebook.com/v21.0/${igId}/insights?metric=audience_gender_age,audience_city&period=lifetime&access_token=${token}`,
        { cacheKey: `${cachePrefix}:demographics`, cacheTtlMs: 24 * 60 * 60 * 1000, tokenId }
      );
      if (demoData?.data) {
        for (const metric of demoData.data) {
          if (metric.name === "audience_gender_age" && metric.values?.[0]?.value) {
            const genderAge = metric.values[0].value;
            let mTotal = 0, fTotal = 0;
            const ageMap: Record<string, number> = {};
            for (const [key, val] of Object.entries(genderAge as Record<string, number>)) {
              const [gender, range] = key.split(".");
              if (gender === "M") mTotal += val;
              if (gender === "F") fTotal += val;
              ageMap[range] = (ageMap[range] || 0) + val;
            }
            const gTotal = mTotal + fTotal;
            if (gTotal > 0) demographics.genderSplit = {
              male: Math.round((mTotal / gTotal) * 100),
              female: Math.round((fTotal / gTotal) * 100),
            };
            const sortedAges = Object.entries(ageMap).sort((a, b) => b[1] - a[1]);
            const ageTotal = sortedAges.reduce((s, [, v]) => s + v, 0);
            demographics.ageRanges = sortedAges.slice(0, 5).map(([range, val]) => ({
              range, pct: Math.round((val / ageTotal) * 100),
            }));
          }
          if (metric.name === "audience_city" && metric.values?.[0]?.value) {
            demographics.topLocations = Object.entries(metric.values[0].value as Record<string, number>)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([city]) => city.split(", ")[0]);
          }
        }
      }
    } catch {}

    // ── Calculate stats ───────────────────────────────────────────
    const followers = profile.followers_count || 0;
    const avgLikes = posts.length
      ? Math.round(posts.reduce((s: number, p: any) => s + (p.like_count || 0), 0) / posts.length) : 0;
    const avgComments = posts.length
      ? Math.round(posts.reduce((s: number, p: any) => s + (p.comments_count || 0), 0) / posts.length) : 0;
    const avgSaves = postsWithInsights.length
      ? Math.round(postsWithInsights.reduce((s, p) => s + (p.saves || 0), 0) / postsWithInsights.length) : 0;
    const engagementRate = followers > 0
      ? (((avgLikes + avgComments) / followers) * 100).toFixed(2) : "0.00";

    const avgReach = postsWithInsights.some(p => p.reach_count > 0)
      ? Math.round(postsWithInsights.reduce((s, p) => s + (p.reach_count || 0), 0) / postsWithInsights.length)
      : reach > 0 ? Math.round(reach / 30) : 0;

    const topPosts = postsWithInsights.map((p, i) => ({
      id: i + 1,
      postId: p.id,
      type: p.media_type === "VIDEO" ? "Reel" : p.media_type === "CAROUSEL_ALBUM" ? "Carousel" : "Post",
      caption: (p.caption || "").substring(0, 100),
      thumbnail: (p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url) || p.thumbnail_url || p.media_url || "",
      permalink: p.permalink || "",
      likes: p.like_count || 0,
      comments: p.comments_count || 0,
      saves: p.saves || 0,
      shares: p.shares || 0,
      reach: p.reach_count || 0,
      er: followers > 0
        ? (((p.like_count || 0) + (p.comments_count || 0) + (p.saves || 0)) / followers * 100).toFixed(1)
        : "0.0",
    }));

    return NextResponse.json({
      connected: true,
      handle: `@${profile.username || account.platform_username}`,
      name: profile.name || account.platform_name,
      followers,
      following: profile.follows_count || 0,
      followersGrowth: 0,
      followersGrowthPct: 0,
      mediaCount: profile.media_count || 0,
      avgReach,
      avgImpressions: impressions > 0 ? Math.round(impressions / 30) : 0,
      engagementRate: parseFloat(engagementRate),
      profileVisits: profileViews,
      avgLikes,
      avgComments,
      avgSaves,
      postsAnalyzed: posts.length,
      followerGrowthChart: followerGrowthChart && followerGrowthChart.length > 1 ? followerGrowthChart : null,
      audienceDemographics: demographics,
      topPosts,
      accountType: account.account_type,
      connectedAt: account.connected_at,
    });

  } catch (err: any) {
    console.error("[/api/insights/instagram]", err.message);
    // Return rate-limit specific error
    if (err.message?.includes("Rate limit") || err.message?.includes("rate limit")) {
      return NextResponse.json({
        error: err.message,
        retryAfter: 3600, // 1 hour in seconds
        cached: true,
      }, { status: 429 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
