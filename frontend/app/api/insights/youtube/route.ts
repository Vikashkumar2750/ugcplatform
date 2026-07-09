import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDailyCache, setDailyCache } from "@/lib/insights-cache";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

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
      .eq("platform", "youtube")
      .eq("is_active", true)
      .order("connected_at", { ascending: false });

    if (!accounts || accounts.length === 0) return NextResponse.json({ error: "not_connected" }, { status: 404 });

    const account = accountId ? accounts.find(a => a.id === accountId) || accounts[0] : accounts[0];
    
    const availableAccounts = accounts.map(a => ({
      id: a.id,
      name: a.platform_name || "YouTube Channel",
      handle: a.platform_username || "",
    }));

    // ── Daily cache check ──
    const cached = await getDailyCache(supabase, user.id, `youtube_${account.id}`, force);
    if (cached) {
      console.log("[YT Insights] Serving daily cache from Supabase");
      return NextResponse.json({ ...cached.data, accountId: account.id, availableAccounts, _fromCache: true });
    }

    let token = account.access_token;
    if (!token) return NextResponse.json({ error: "No access token" }, { status: 401 });

    // Check if token is expired (or close to expiring in next 5 mins)
    const expiresAt = new Date(account.token_expires_at).getTime();
    const isExpired = !account.token_expires_at || expiresAt < Date.now() + 5 * 60 * 1000;

    if (isExpired && account.refresh_token) {
      console.log("[YT Insights] Token expired, refreshing...");
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: account.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        token = tokenData.access_token;
        const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
        
        // Update in database
        await supabase.from("connected_accounts").update({
          access_token: token,
          token_expires_at: newExpiresAt,
        }).eq("id", account.id);
        
        console.log("[YT Insights] Token refreshed successfully");
      } else {
        console.error("[YT Insights] Failed to refresh token:", tokenData);
        // If refresh fails (e.g. revoked), we should still try the old token or just fail
        if (tokenData.error === "invalid_grant") {
          return NextResponse.json({ error: "YouTube access revoked or expired. Please reconnect your account." }, { status: 401 });
        }
      }
    }

    // Helper for YouTube API calls
    const fetchYT = async (url: string) => {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `YouTube API error: ${res.status}`);
      }
      return res.json();
    };

    // 1. Fetch Channel Info
    const channelData = await fetchYT("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true");
    if (!channelData.items || channelData.items.length === 0) {
      return NextResponse.json({ error: "No channel found for this account" }, { status: 404 });
    }

    const channel = channelData.items[0];
    const stats = channel.statistics || {};
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

    // 2. Fetch Recent Videos from Uploads Playlist
    let recentVideos = [];
    if (uploadsPlaylistId) {
      const playlistData = await fetchYT(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=10`);
      
      const items = playlistData.items || [];
      if (items.length > 0) {
        const videoIds = items.map((item: any) => item.contentDetails.videoId).join(",");
        
        // 3. Fetch stats for these specific videos
        const videosData = await fetchYT(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}`);
        const videoStatsMap = new Map();
        (videosData.items || []).forEach((v: any) => {
          videoStatsMap.set(v.id, v.statistics);
        });

        recentVideos = items.map((item: any) => {
          const vId = item.contentDetails.videoId;
          const vStats = videoStatsMap.get(vId) || {};
          return {
            id: vId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
            publishedAt: item.snippet.publishedAt,
            views: parseInt(vStats.viewCount || "0", 10),
            likes: parseInt(vStats.likeCount || "0", 10),
            comments: parseInt(vStats.commentCount || "0", 10),
          };
        });
      }
    }

    const subscribers = parseInt(stats.subscriberCount || "0", 10);
    const totalViewsCount = parseInt(stats.viewCount || "0", 10);
    const videoCountVal = parseInt(stats.videoCount || "0", 10);

    const avgLikes = recentVideos.length ? Math.round(recentVideos.reduce((s: number, v: any) => s + v.likes, 0) / recentVideos.length) : 0;
    const avgComments = recentVideos.length ? Math.round(recentVideos.reduce((s: number, v: any) => s + v.comments, 0) / recentVideos.length) : 0;
    const avgViews = recentVideos.length ? Math.round(recentVideos.reduce((s: number, v: any) => s + v.views, 0) / recentVideos.length) : 0;

    const formattedTopPosts = recentVideos.slice(0, 5).map((v: any, idx: number) => ({
      id: idx + 1,
      postId: v.id,
      type: "Video",
      er: subscribers > 0 ? (((v.likes + v.comments) / subscribers) * 100).toFixed(1) : "0.0",
      likes: v.likes,
      comments: v.comments,
      saves: 0,
      reach: v.views,
      caption: v.title
    }));

    // ── 8. Calculate Deterministic Scores ────────────────────────
    const posts7dCount = recentVideos.filter((v: any) => Date.now() - new Date(v.publishedAt).getTime() < 7 * 86400 * 1000).length;
    let consistencyScore = 40;
    if (recentVideos.length >= 8) consistencyScore = 100;
    else if (recentVideos.length >= 4) consistencyScore = 80;
    else if (recentVideos.length >= 2) consistencyScore = 60;

    let engagementScore = 40;
    const er = subscribers > 0 ? parseFloat((((avgLikes + avgComments) / subscribers) * 100).toFixed(2)) : 0;
    if (er >= 5) engagementScore = 100;
    else if (er >= 3) engagementScore = 80;
    else if (er >= 1.5) engagementScore = 60;

    let growthScore = 50; // hard to determine without historical API for youtube in this simple implementation, let's base it on recent video count
    if (posts7dCount >= 3) growthScore = 100;
    else if (posts7dCount >= 1) growthScore = 80;
    else growthScore = 60;

    let contentScore = 50;
    if (formattedTopPosts.length > 0 && typeof formattedTopPosts[0] === 'object' && 'er' in formattedTopPosts[0]) {
      const topEr = parseFloat((formattedTopPosts[0] as any).er || "0");
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
      channelId: channel.id,
      channelName: channel.snippet.title,
      avatar: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
      subscribers,
      totalViews: totalViewsCount,
      videoCount: videoCountVal,
      recentVideos,
      connectedAt: account.connected_at,
      availableAccounts,
      ...scores,
      aiData,
    };

    await setDailyCache(supabase, user.id, `youtube_${account.id}`, responseData);
    return NextResponse.json({ ...responseData, _fromCache: false, _fetchedAt: new Date().toISOString() });

  } catch (err: any) {
    console.error("YouTube Insights Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch YouTube data" }, { status: 500 });
  }
}
