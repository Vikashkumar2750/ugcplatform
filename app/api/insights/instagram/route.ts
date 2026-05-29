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

    // ── 2. Recent Media (for ER calculation) ─────────────────────
    const mediaRes = await fetch(
      `https://graph.facebook.com/v21.0/${igId}/media?fields=id,timestamp,media_type,like_count,comments_count&limit=30&access_token=${token}`
    );
    const mediaData = await mediaRes.json();
    const posts = mediaData.data || [];

    // Calculate average likes, comments, ER
    const avgLikes = posts.length
      ? Math.round(posts.reduce((s: number, p: any) => s + (p.like_count || 0), 0) / posts.length)
      : 0;
    const avgComments = posts.length
      ? Math.round(posts.reduce((s: number, p: any) => s + (p.comments_count || 0), 0) / posts.length)
      : 0;
    const followers = profile.followers_count || 0;
    const engagementRate = followers > 0
      ? (((avgLikes + avgComments) / followers) * 100).toFixed(2)
      : "0.00";

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
    const topPosts = posts
      .sort((a: any, b: any) => ((b.like_count || 0) + (b.comments_count || 0)) - ((a.like_count || 0) + (a.comments_count || 0)))
      .slice(0, 3)
      .map((p: any, i: number) => ({
        id: i + 1,
        type: p.media_type === "VIDEO" ? "Reel" : p.media_type === "CAROUSEL_ALBUM" ? "Carousel" : "Post",
        caption: "Post " + (i + 1),
        likes: p.like_count || 0,
        comments: p.comments_count || 0,
        reach: 0, // Needs separate media insights call
        er: followers > 0
          ? (((p.like_count || 0) + (p.comments_count || 0)) / followers * 100).toFixed(1)
          : "0.0",
      }));

    return NextResponse.json({
      connected: true,
      handle: `@${profile.username || account.platform_username}`,
      name: profile.name || account.platform_name,
      followers,
      followersGrowth: 0, // Would need comparison period
      followersGrowthPct: 0,
      mediaCount: profile.media_count || 0,
      avgReach: posts.length > 0 ? Math.round(reach / 30) : 0,
      avgImpressions: posts.length > 0 ? Math.round(impressions / 30) : 0,
      engagementRate: parseFloat(engagementRate),
      profileVisits: profileViews,
      avgLikes,
      avgComments,
      postsAnalyzed: posts.length,
      followerGrowthChart: followerGrowthChart.length > 0 ? followerGrowthChart : null,
      audienceDemographics: demographics,
      topPosts,
      // Meta info
      accountType: account.account_type,
      connectedAt: account.connected_at,
    });

  } catch (err: any) {
    console.error("[/api/insights/instagram]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
