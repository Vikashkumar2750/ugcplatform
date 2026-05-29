import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get connected Instagram account from DB
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

    // ── 1. Basic Profile ──────────────────────────────────────────
    const profileRes = await fetch(
      `https://graph.facebook.com/v21.0/${igId}?fields=id,username,name,biography,followers_count,follows_count,media_count,website&access_token=${token}`
    );
    const profile = await profileRes.json();

    // ── 2. Recent Media with caption ─────────────────────────────
    const mediaRes = await fetch(
      `https://graph.facebook.com/v21.0/${igId}/media?fields=id,timestamp,media_type,like_count,comments_count,caption,thumbnail_url,media_url,permalink&limit=30&access_token=${token}`
    );
    const mediaData = await mediaRes.json();
    const posts = mediaData.data || [];

    // Fetch per-post insights (saves, reach, impressions, shares)
    const postsWithInsights = await Promise.all(
      posts.slice(0, 10).map(async (p: any) => {
        try {
          const piRes = await fetch(
            `https://graph.facebook.com/v21.0/${p.id}/insights?metric=saved,reach,impressions,shares&access_token=${token}`
          );
          const pi = await piRes.json();
          const findMetric = (name: string) =>
            pi.data?.find((m: any) => m.name === name)?.values?.[0]?.value || 0;
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

    // Calculate averages
    const avgLikes = posts.length
      ? Math.round(posts.reduce((s: number, p: any) => s + (p.like_count || 0), 0) / posts.length) : 0;
    const avgComments = posts.length
      ? Math.round(posts.reduce((s: number, p: any) => s + (p.comments_count || 0), 0) / posts.length) : 0;
    const avgSaves = postsWithInsights.length
      ? Math.round(postsWithInsights.reduce((s, p) => s + (p.saves || 0), 0) / postsWithInsights.length) : 0;
    const followers = profile.followers_count || 0;
    const engagementRate = followers > 0
      ? (((avgLikes + avgComments) / followers) * 100).toFixed(2) : "0.00";

    // ── 3. Account Insights (reach, impressions, profile_views) ──
    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // 30 days ago
    const until = Math.floor(Date.now() / 1000);

    let reach = 0, impressions = 0, profileViews = 0;
    try {
      const insightsRes = await fetch(
        `https://graph.facebook.com/v21.0/${igId}/insights?metric=reach,impressions,profile_views&period=day&since=${since}&until=${until}&access_token=${token}`
      );
      const insightsData = await insightsRes.json();
      if (insightsData.data) {
        for (const metric of insightsData.data) {
          const total = (metric.values || []).reduce((s: number, v: any) => s + (v.value || 0), 0);
          if (metric.name === "reach") reach = total;
          if (metric.name === "impressions") impressions = total;
          if (metric.name === "profile_views") profileViews = total;
        }
      }
    } catch { /* Insights might not be available in dev mode */ }

    // ── 4. Follower Growth (last 30 days) ────────────────────────
    let followerGrowthChart: { date: string; followers: number }[] = [];
    try {
      const growthRes = await fetch(
        `https://graph.facebook.com/v21.0/${igId}/insights?metric=follower_count&period=day&since=${since}&until=${until}&access_token=${token}`
      );
      const growthData = await growthRes.json();
      const followerMetric = growthData.data?.find((d: any) => d.name === "follower_count");
      if (followerMetric?.values?.length) {
        followerGrowthChart = followerMetric.values
          .filter((_: any, i: number) => i % 5 === 0) // Sample every 5 days
          .map((v: any) => ({
            date: new Date(v.end_time).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
            followers: v.value,
          }));
      }
    } catch {}

    // ── 5. Audience Demographics ─────────────────────────────────
    let demographics = {
      ageRanges: [] as { range: string; pct: number }[],
      topLocations: [] as string[],
      genderSplit: { male: 50, female: 50 },
    };
    try {
      const demoRes = await fetch(
        `https://graph.facebook.com/v21.0/${igId}/insights?metric=audience_gender_age,audience_city&period=lifetime&access_token=${token}`
      );
      const demoData = await demoRes.json();
      if (demoData.data) {
        for (const metric of demoData.data) {
          if (metric.name === "audience_gender_age" && metric.values?.[0]?.value) {
            const genderAge = metric.values[0].value;
            // Parse gender split
            let mTotal = 0, fTotal = 0;
            const ageMap: Record<string, number> = {};
            for (const [key, val] of Object.entries(genderAge as Record<string, number>)) {
              const [gender, range] = key.split(".");
              if (gender === "M") mTotal += val;
              if (gender === "F") fTotal += val;
              ageMap[range] = (ageMap[range] || 0) + val;
            }
            const gTotal = mTotal + fTotal;
            if (gTotal > 0) {
              demographics.genderSplit = {
                male: Math.round((mTotal / gTotal) * 100),
                female: Math.round((fTotal / gTotal) * 100),
              };
            }
            // Age ranges
            const sortedAges = Object.entries(ageMap).sort((a, b) => b[1] - a[1]);
            const ageTotal = sortedAges.reduce((s, [, v]) => s + v, 0);
            demographics.ageRanges = sortedAges.slice(0, 5).map(([range, val]) => ({
              range,
              pct: Math.round((val / ageTotal) * 100),
            }));
          }
          if (metric.name === "audience_city" && metric.values?.[0]?.value) {
            const cities = Object.entries(metric.values[0].value as Record<string, number>)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([city]) => city.split(", ")[0]); // Remove country suffix
            demographics.topLocations = cities;
          }
        }
      }
    } catch {}

    // ── 6. Top Posts ──────────────────────────────────────────────
    const topPosts = postsWithInsights
      .sort((a, b) =>
        ((b.like_count || 0) + (b.comments_count || 0) + (b.saves || 0)) -
        ((a.like_count || 0) + (a.comments_count || 0) + (a.saves || 0)))
      .slice(0, 5)
      .map((p, i) => ({
        id: i + 1,
        postId: p.id,
        type: p.media_type === "VIDEO" ? "Reel" : p.media_type === "CAROUSEL_ALBUM" ? "Carousel" : "Post",
        caption: (p.caption || "").substring(0, 80),
        thumbnail: p.thumbnail_url || p.media_url || "",
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
      avgReach: postsWithInsights.length > 0
        ? Math.round(postsWithInsights.reduce((s, p) => s + (p.reach_count || 0), 0) / postsWithInsights.length) : 0,
      avgImpressions: postsWithInsights.length > 0
        ? Math.round(postsWithInsights.reduce((s, p) => s + (p.impressions_count || 0), 0) / postsWithInsights.length) : 0,
      engagementRate: parseFloat(engagementRate),
      profileVisits: profileViews,
      avgLikes,
      avgComments,
      avgSaves,
      postsAnalyzed: posts.length,
      followerGrowthChart: followerGrowthChart.length > 0 ? followerGrowthChart : null,
      audienceDemographics: demographics,
      topPosts,
      accountType: account.account_type,
      connectedAt: account.connected_at,
    });

  } catch (err: any) {
    console.error("[/api/insights/instagram]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
