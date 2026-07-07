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
      return NextResponse.json({ ...cached.data, _fromCache: true });
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

    const responseData = {
      connected: true,
      channelId: channel.id,
      channelName: channel.snippet.title,
      avatar: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
      subscribers: parseInt(stats.subscriberCount || "0", 10),
      totalViews: parseInt(stats.viewCount || "0", 10),
      videoCount: parseInt(stats.videoCount || "0", 10),
      recentVideos,
      connectedAt: account.connected_at,
      availableAccounts,
    };

    await setDailyCache(supabase, user.id, `youtube_${account.id}`, responseData);
    return NextResponse.json({ ...responseData, _fromCache: false, _fetchedAt: new Date().toISOString() });

  } catch (err: any) {
    console.error("YouTube Insights Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch YouTube data" }, { status: 500 });
  }
}
