import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { metaFetch } from "@/lib/meta-rate-limit";
import { getDailyCache, setDailyCache } from "@/lib/insights-cache";

// Helper: unix timestamp N days ago
const daysAgo = (n: number) => Math.floor(Date.now() / 1000) - n * 86400;

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
      .eq("platform", "instagram")
      .eq("is_active", true)
      .order("connected_at", { ascending: false });

    if (!accounts || accounts.length === 0) return NextResponse.json({ error: "not_connected" }, { status: 404 });

    const account = accountId ? accounts.find(a => a.id === accountId) || accounts[0] : accounts[0];
    
    const availableAccounts = accounts.map(a => ({
      id: a.id,
      name: a.platform_name || "Instagram Account",
      handle: a.platform_username || "",
    }));

    // ── Daily cache check (skip Meta API if already fetched today IST) ──
    const cached = await getDailyCache(supabase, user.id, "instagram", force);
    if (cached) {
      console.log("[IG Insights] Serving daily cache from Supabase");
      return NextResponse.json({ ...cached.data, _fromCache: true });
    }

    const igId = account.platform_user_id;
    const token = account.access_token;
    const tokenId = `ig:${account.id}`;
    const cachePrefix = `ig:${account.id}`;

    // ── 1. Profile (cached 30min) ─────────────────────────────────
    const { data: profile } = await metaFetch(
      `https://graph.facebook.com/v21.0/${igId}?fields=id,username,name,biography,followers_count,follows_count,media_count,website,profile_picture_url&access_token=${token}`,
      { cacheKey: `${cachePrefix}:profile`, cacheTtlMs: 30 * 60 * 1000, tokenId }
    );

    if (profile?.error) {
      const code = profile.error.code;
      return NextResponse.json({
        error: code === 190 ? "Access token expired — please reconnect Instagram" : profile.error.message,
        code,
      }, { status: 400 });
    }

    // ── 2. Recent Media (cached 15min) ────────────────────────────
    const { data: mediaData } = await metaFetch(
      `https://graph.facebook.com/v21.0/${igId}/media?fields=id,timestamp,media_type,like_count,comments_count,caption,thumbnail_url,media_url,permalink&limit=30&access_token=${token}`,
      { cacheKey: `${cachePrefix}:media`, cacheTtlMs: 15 * 60 * 1000, tokenId }
    );
    const posts: any[] = mediaData?.data || [];

    // ── Split posts into 7d current, 7d previous, 30d ─────────────
    const now = Date.now();
    const posts7d    = posts.filter(p => now - new Date(p.timestamp).getTime() < 7 * 86400 * 1000);
    const postsPrev7d = posts.filter(p => {
      const age = now - new Date(p.timestamp).getTime();
      return age >= 7 * 86400 * 1000 && age < 14 * 86400 * 1000;
    });
    const posts30d   = posts.filter(p => now - new Date(p.timestamp).getTime() < 30 * 86400 * 1000);

    // ── Per-post insights (top 5, cached 1hr) ─────────────────────
    const topRaw = posts
      .sort((a, b) => ((b.like_count || 0) + (b.comments_count || 0)) - ((a.like_count || 0) + (a.comments_count || 0)))
      .slice(0, 5);

    const postsWithInsights = await Promise.all(
      topRaw.map(async (p: any) => {
        try {
          const { data: pi } = await metaFetch(
            `https://graph.facebook.com/v21.0/${p.id}/insights?metric=saved,reach,impressions,shares&access_token=${token}`,
            { cacheKey: `${cachePrefix}:post:${p.id}`, cacheTtlMs: 60 * 60 * 1000, tokenId }
          );
          const find = (name: string) =>
            pi?.data?.find((m: any) => m.name === name)?.values?.[0]?.value || 0;
          return { ...p, saves: find("saved"), reach_count: find("reach"), impressions_count: find("impressions"), shares: find("shares") };
        } catch {
          return { ...p, saves: 0, reach_count: 0, impressions_count: 0, shares: 0 };
        }
      })
    );

    // ── 3. Account-level insights — 30d + 7d + prev 7d (cached 1hr)
    const metricsList = "reach,impressions,profile_views,website_clicks";
    let reach30d = 0, impressions30d = 0, profileViews = 0, websiteClicks = 0;
    let reach7d = 0, impressions7d = 0;
    let reachPrev7d = 0, impressionsPrev7d = 0;
    let followerGrowthChart: { date: string; followers: number }[] | null = null;

    // 30-day window
    try {
      const { data: ins30 } = await metaFetch(
        `https://graph.facebook.com/v21.0/${igId}/insights?metric=${metricsList},follower_count&period=day&since=${daysAgo(30)}&until=${daysAgo(0)}&access_token=${token}`,
        { cacheKey: `${cachePrefix}:ins30`, cacheTtlMs: 60 * 60 * 1000, tokenId }
      );
      if (ins30?.data) {
        for (const m of ins30.data) {
          const vals = m.values || [];
          const total = vals.reduce((s: number, v: any) => s + (v.value || 0), 0);
          if (m.name === "reach") reach30d = total;
          if (m.name === "impressions") impressions30d = total;
          if (m.name === "profile_views") profileViews = total;
          if (m.name === "website_clicks") websiteClicks = total;
          if (m.name === "follower_count" && vals.length > 1) {
            followerGrowthChart = vals
              .filter((_: any, i: number) => i % 3 === 0)
              .map((v: any) => ({
                date: new Date(v.end_time).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
                followers: v.value,
              }));
          }
        }
      }
    } catch (e: any) {
      console.warn("[IG] Account insights 30d failed:", e.message);
    }

    // Current 7-day window
    try {
      const { data: ins7 } = await metaFetch(
        `https://graph.facebook.com/v21.0/${igId}/insights?metric=reach,impressions&period=day&since=${daysAgo(7)}&until=${daysAgo(0)}&access_token=${token}`,
        { cacheKey: `${cachePrefix}:ins7d`, cacheTtlMs: 60 * 60 * 1000, tokenId }
      );
      if (ins7?.data) {
        for (const m of ins7.data) {
          const total = (m.values || []).reduce((s: number, v: any) => s + (v.value || 0), 0);
          if (m.name === "reach") reach7d = total;
          if (m.name === "impressions") impressions7d = total;
        }
      }
    } catch {}

    // Previous 7-day window (8-14 days ago)
    try {
      const { data: insPrev } = await metaFetch(
        `https://graph.facebook.com/v21.0/${igId}/insights?metric=reach,impressions&period=day&since=${daysAgo(14)}&until=${daysAgo(7)}&access_token=${token}`,
        { cacheKey: `${cachePrefix}:ins_prev7d`, cacheTtlMs: 60 * 60 * 1000, tokenId }
      );
      if (insPrev?.data) {
        for (const m of insPrev.data) {
          const total = (m.values || []).reduce((s: number, v: any) => s + (v.value || 0), 0);
          if (m.name === "reach") reachPrev7d = total;
          if (m.name === "impressions") impressionsPrev7d = total;
        }
      }
    } catch {}

    // ── 4. Audience demographics (cached 24hr) ────────────────────
    let demographics = {
      ageRanges: [] as { range: string; pct: number }[],
      topLocations: [] as string[],
      genderSplit: { male: 50, female: 50 },
    };
    try {
      const { data: demoData } = await metaFetch(
        `https://graph.facebook.com/v21.0/${igId}/insights?metric=audience_gender_age,audience_city,audience_country&period=lifetime&access_token=${token}`,
        { cacheKey: `${cachePrefix}:demographics`, cacheTtlMs: 24 * 60 * 60 * 1000, tokenId }
      );
      if (demoData?.data) {
        for (const metric of demoData.data) {
          if (metric.name === "audience_gender_age" && metric.values?.[0]?.value) {
            const genderAge = metric.values[0].value as Record<string, number>;
            let mTotal = 0, fTotal = 0;
            const ageMap: Record<string, number> = {};
            for (const [key, val] of Object.entries(genderAge)) {
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
          if ((metric.name === "audience_city" || metric.name === "audience_country") && metric.values?.[0]?.value) {
            const entries = Object.entries(metric.values[0].value as Record<string, number>)
              .sort((a, b) => b[1] - a[1]).slice(0, 5)
              .map(([city]) => city.split(", ")[0]);
            if (entries.length > demographics.topLocations.length) demographics.topLocations = entries;
          }
        }
      }
    } catch {}

    // ── 5. Stats calculations ─────────────────────────────────────
    const followers = profile.followers_count || 0;

    const avgLikes30d = posts30d.length
      ? Math.round(posts30d.reduce((s, p) => s + (p.like_count || 0), 0) / posts30d.length) : 0;
    const avgComments30d = posts30d.length
      ? Math.round(posts30d.reduce((s, p) => s + (p.comments_count || 0), 0) / posts30d.length) : 0;
    const avgLikes7d = posts7d.length
      ? Math.round(posts7d.reduce((s, p) => s + (p.like_count || 0), 0) / posts7d.length) : 0;
    const avgComments7d = posts7d.length
      ? Math.round(posts7d.reduce((s, p) => s + (p.comments_count || 0), 0) / posts7d.length) : 0;
    const avgLikesPrev7d = postsPrev7d.length
      ? Math.round(postsPrev7d.reduce((s, p) => s + (p.like_count || 0), 0) / postsPrev7d.length) : 0;
    const avgCommentsPrev7d = postsPrev7d.length
      ? Math.round(postsPrev7d.reduce((s, p) => s + (p.comments_count || 0), 0) / postsPrev7d.length) : 0;

    const avgSaves = postsWithInsights.length
      ? Math.round(postsWithInsights.reduce((s, p) => s + (p.saves || 0), 0) / postsWithInsights.length) : 0;

    const er30d = followers > 0 ? parseFloat((((avgLikes30d + avgComments30d) / followers) * 100).toFixed(2)) : 0;
    const er7d  = followers > 0 ? parseFloat((((avgLikes7d + avgComments7d) / followers) * 100).toFixed(2)) : 0;
    const erPrev7d = followers > 0 ? parseFloat((((avgLikesPrev7d + avgCommentsPrev7d) / followers) * 100).toFixed(2)) : 0;

    const avgReach = postsWithInsights.some(p => p.reach_count > 0)
      ? Math.round(postsWithInsights.reduce((s, p) => s + (p.reach_count || 0), 0) / postsWithInsights.length)
      : reach30d > 0 ? Math.round(reach30d / 30) : 0;

    // ── 6. 7-day vs prev 7-day comparison ─────────────────────────
    const pct = (curr: number, prev: number) => prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);

    const comparison7d = {
      reach:       { current: reach7d, previous: reachPrev7d, pct: pct(reach7d, reachPrev7d) },
      impressions: { current: impressions7d, previous: impressionsPrev7d, pct: pct(impressions7d, impressionsPrev7d) },
      likes:       { current: avgLikes7d, previous: avgLikesPrev7d, pct: pct(avgLikes7d, avgLikesPrev7d) },
      comments:    { current: avgComments7d, previous: avgCommentsPrev7d, pct: pct(avgComments7d, avgCommentsPrev7d) },
      posts:       { current: posts7d.length, previous: postsPrev7d.length, pct: pct(posts7d.length, postsPrev7d.length) },
      er:          { current: er7d, previous: erPrev7d, pct: pct(er7d, erPrev7d) },
    };

    // ── 7. Top Posts ──────────────────────────────────────────────
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
        ? (((p.like_count || 0) + (p.comments_count || 0) + (p.saves || 0)) / followers * 100).toFixed(1) : "0.0",
      timestamp: p.timestamp,
    }));

    const responseData = {
      connected: true,
      handle: `@${profile.username || account.platform_username}`,
      name: profile.name || account.platform_name,
      avatar: profile.profile_picture_url || null,
      followers,
      following: profile.follows_count || 0,
      mediaCount: profile.media_count || 0,
      avgReach,
      avgImpressions: impressions30d > 0 ? Math.round(impressions30d / 30) : 0,
      engagementRate: er30d,
      profileVisits: profileViews,
      websiteClicks,
      avgLikes: avgLikes30d,
      avgComments: avgComments30d,
      avgSaves,
      postsAnalyzed: posts.length,
      posts30dCount: posts30d.length,
      posts7dCount: posts7d.length,
      comparison7d,
      followerGrowthChart: followerGrowthChart && followerGrowthChart.length > 1 ? followerGrowthChart : null,
      audienceDemographics: demographics,
      topPosts,
      accountType: account.account_type,
      connectedAt: account.connected_at,
      availableAccounts,
    };
    await setDailyCache(supabase, user.id, "instagram", responseData);
    return NextResponse.json({ ...responseData, _fromCache: false, _fetchedAt: new Date().toISOString() });

  } catch (err: any) {
    console.error("[/api/insights/instagram]", err.message);
    if (err.message?.includes("Rate limit") || err.message?.includes("rate limit")) {
      return NextResponse.json({ error: err.message, retryAfter: 3600 }, { status: 429 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
