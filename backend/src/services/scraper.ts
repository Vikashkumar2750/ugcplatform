// Scraper service — Multi-source with automatic fallbacks
// Priority: RapidAPI (instagram120) → RapidAPI alt → Apify (profile + posts) → empty

const RAPID_API_KEY = process.env.RAPIDAPI_KEY || "";
const APIFY_TOKEN = process.env.APIFY_TOKEN || "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScrapeResult {
  posts: ScrapedPost[];
  profile?: ProfileInfo;
}

export interface ScrapedPost {
  id: string;
  caption?: string;
  likes?: number;
  comments?: number;
  views?: number;
  timestamp?: string;
  mediaUrl?: string;
  url?: string;
  type?: string;         // IMAGE | VIDEO | CAROUSEL_ALBUM
  hashtags?: string[];
}

export interface ProfileInfo {
  username: string;
  fullName?: string;
  followers?: number;
  following?: number;
  posts?: number;
  bio?: string;
  verified?: boolean;
  isBusinessAccount?: boolean;
  profilePicUrl?: string;
}

// ─── ENHANCED Competitor Data (from Apify full scrape) ────────────────────────

export interface EnhancedCompetitorData {
  username: string;
  profile: {
    fullName: string;
    followers: number;
    following: number;
    postsCount: number;
    bio: string;
    verified: boolean;
    isBusinessAccount: boolean;
    profilePicUrl?: string;
  };
  topPosts: EnhancedPost[];
  recentPosts: EnhancedPost[];
  allPosts: EnhancedPost[];
  engagementStats: {
    avgLikes: number;
    avgComments: number;
    avgViews: number;
    engagementRate: number;
    topPostViews: number;
    totalPostsAnalyzed: number;
  };
}

export interface EnhancedPost {
  id: string;
  type: string;
  caption: string;
  hashtags: string[];
  likes: number;
  comments: number;
  views: number;
  timestamp: string;
  url: string;
  // Extracted insights
  captionLength: number;
  hasQuestion: boolean;
  hasCTA: boolean;
  hookText: string; // first 100 chars of caption
}

// ─── Instagram — Multiple API sources with fallback ──────────────────────────

export async function scrapeInstagramProfile(username: string): Promise<ScrapeResult> {
  // Source 1: instagram120 RapidAPI
  if (RAPID_API_KEY) {
    try {
      const result = await scrapeViaInstagram120(username);
      if (result.posts.length > 0 || result.profile) {
        console.log(`[scraper] instagram120 success for @${username}: ${result.posts.length} posts`);
        return result;
      }
    } catch (e: any) {
      console.warn(`[scraper] instagram120 failed for @${username}: ${e.message}`);
    }

    // Source 2: instagram-scraper3 RapidAPI
    try {
      const result = await scrapeViaInstagramScraper3(username);
      if (result.posts.length > 0 || result.profile) {
        console.log(`[scraper] instagram-scraper3 success for @${username}`);
        return result;
      }
    } catch (e: any) {
      console.warn(`[scraper] instagram-scraper3 failed for @${username}: ${e.message}`);
    }
  }

  // Source 3: Apify
  if (APIFY_TOKEN) {
    try {
      const result = await scrapeViaApifyBasic(username);
      if (result.posts.length > 0 || result.profile) {
        console.log(`[scraper] Apify basic success for @${username}`);
        return result;
      }
    } catch (e: any) {
      console.warn(`[scraper] Apify basic failed for @${username}: ${e.message}`);
    }
  }

  console.warn(`[scraper] All sources failed for @${username} — returning empty`);
  return { posts: [], profile: { username } };
}

// ─── ENHANCED Competitor Scrape (uses BOTH Apify actors for maximum data) ─────

export async function scrapeCompetitorFull(username: string): Promise<EnhancedCompetitorData> {
  console.log(`[scraper] Starting enhanced scrape for @${username}`);

  let profile: ProfileInfo = { username };
  let rawPosts: ScrapedPost[] = [];

  // === APIFY: Profile + Posts (most comprehensive) ===
  if (APIFY_TOKEN) {
    // Run both actors in parallel for speed
    const [profileResult, postsResult] = await Promise.allSettled([
      runApifyActor("apify/instagram-profile-scraper", { usernames: [username] }),
      runApifyActor("apify/instagram-scraper", {
        usernames: [username],
        resultsType: "posts",
        resultsLimit: 30,
        addParentData: false,
      }),
    ]);

    // Process profile data
    if (profileResult.status === "fulfilled" && profileResult.value.length > 0) {
      const p = profileResult.value[0];
      profile = {
        username: p.username || p.inputUrl?.split("/").filter(Boolean).pop() || username,
        fullName: p.fullName || p.name || "",
        followers: p.followersCount || p.followedByCount || 0,
        following: p.followsCount || p.followingCount || 0,
        posts: p.postsCount || p.mediaCount || 0,
        bio: p.biography || p.description || "",
        verified: p.verified || false,
        isBusinessAccount: p.isBusinessAccount || false,
        profilePicUrl: p.profilePicUrl || p.profilePicUrlHD || "",
      };
      console.log(`[scraper] Apify profile: @${profile.username}, ${profile.followers} followers, bio: "${profile.bio?.substring(0, 50)}"`);
    } else {
      console.warn(`[scraper] Apify profile scraper failed for @${username}: ${profileResult.status === "rejected" ? (profileResult as any).reason : "empty"}`);
    }

    // Process posts data
    if (postsResult.status === "fulfilled" && postsResult.value.length > 0) {
      rawPosts = postsResult.value.map((item: any) => ({
        id: item.id || item.shortCode || String(Math.random()),
        caption: item.caption || item.text || "",
        likes: item.likesCount || item.likes || item.likeCount || 0,
        comments: item.commentsCount || item.comments || item.commentCount || 0,
        views: item.videoViewCount || item.videoPlayCount || item.playsCount || item.viewCount || 0,
        timestamp: item.timestamp || item.takenAt || "",
        url: item.url || `https://www.instagram.com/p/${item.shortCode}/`,
        type: item.type || (item.videoViewCount > 0 ? "VIDEO" : "IMAGE"),
        hashtags: extractHashtags(item.caption || item.text || ""),
      }));
      console.log(`[scraper] Apify posts: ${rawPosts.length} posts for @${username}`);
    } else {
      console.warn(`[scraper] Apify posts scraper failed for @${username}`);
      // Fallback to basic scrape
      try {
        const fallback = await scrapeInstagramProfile(username);
        rawPosts = fallback.posts;
        if (!profile.followers && fallback.profile) {
          profile = { ...profile, ...fallback.profile };
        }
      } catch {}
    }
  } else {
    // No Apify — use RapidAPI
    try {
      const result = await scrapeInstagramProfile(username);
      rawPosts = result.posts;
      if (result.profile) profile = { ...profile, ...result.profile };
    } catch (e: any) {
      console.warn(`[scraper] All scrapers failed for @${username}`);
    }
  }

  // === Process and enhance posts ===
  const enhancedPosts: EnhancedPost[] = rawPosts.map(p => ({
    id: p.id,
    type: p.type || "IMAGE",
    caption: p.caption || "",
    hashtags: p.hashtags || extractHashtags(p.caption || ""),
    likes: p.likes || 0,
    comments: p.comments || 0,
    views: p.views || 0,
    timestamp: p.timestamp || "",
    url: p.url || "",
    captionLength: (p.caption || "").length,
    hasQuestion: /\?/.test(p.caption || ""),
    hasCTA: /(comment|share|save|follow|dm|link in bio|click|grab|get|download)/i.test(p.caption || ""),
    hookText: (p.caption || "").substring(0, 120),
  }));

  // Sort: top by views/likes
  const topPosts = [...enhancedPosts]
    .sort((a, b) => (b.views || b.likes) - (a.views || a.likes))
    .slice(0, 12);

  const recentPosts = [...enhancedPosts]
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 8);

  // Engagement stats
  const totalPosts = enhancedPosts.length;
  const avgLikes = totalPosts > 0 ? Math.round(enhancedPosts.reduce((s, p) => s + p.likes, 0) / totalPosts) : 0;
  const avgComments = totalPosts > 0 ? Math.round(enhancedPosts.reduce((s, p) => s + p.comments, 0) / totalPosts) : 0;
  const avgViews = totalPosts > 0 ? Math.round(enhancedPosts.reduce((s, p) => s + p.views, 0) / totalPosts) : 0;
  const followers = profile.followers || 1;
  const engagementRate = followers > 0
    ? parseFloat(((avgLikes + avgComments) / followers * 100).toFixed(2))
    : 0;
  const topPostViews = topPosts[0]?.views || topPosts[0]?.likes || 0;

  return {
    username: profile.username || username,
    profile: {
      fullName: profile.fullName || username,
      followers: profile.followers || 0,
      following: profile.following || 0,
      postsCount: profile.posts || totalPosts,
      bio: profile.bio || "",
      verified: profile.verified || false,
      isBusinessAccount: profile.isBusinessAccount || false,
      profilePicUrl: profile.profilePicUrl,
    },
    topPosts,
    recentPosts,
    allPosts: enhancedPosts,
    engagementStats: {
      avgLikes,
      avgComments,
      avgViews,
      engagementRate,
      topPostViews,
      totalPostsAnalyzed: totalPosts,
    },
  };
}

// ─── Helper: extract hashtags from caption ────────────────────────────────────
function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#[a-zA-Z0-9_]+/g) || [];
  return [...new Set(matches)].slice(0, 30);
}

// ── Source 1: instagram120 RapidAPI ──────────────────────────────────────────
async function scrapeViaInstagram120(username: string): Promise<ScrapeResult> {
  const headers = {
    "Content-Type": "application/json",
    "x-rapidapi-host": "instagram120.p.rapidapi.com",
    "x-rapidapi-key": RAPID_API_KEY,
  };

  const postsRes = await fetch("https://instagram120.p.rapidapi.com/api/instagram/posts", {
    method: "POST",
    headers,
    body: JSON.stringify({ username, maxId: "" }),
  });

  if (!postsRes.ok) throw new Error(`instagram120 posts: ${postsRes.status}`);
  const postsData = await postsRes.json();

  const items = postsData.data?.items || postsData.items || [];
  const posts: ScrapedPost[] = items.map((item: any) => ({
    id: item.id || item.pk || String(Math.random()),
    caption: item.caption?.text || item.caption || "",
    likes: item.like_count || item.likes || 0,
    comments: item.comment_count || item.comments || 0,
    views: item.view_count || item.play_count || item.video_view_count || 0,
    timestamp: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : undefined,
    url: `https://www.instagram.com/p/${item.code || item.shortcode}/`,
    type: item.media_type === 2 ? "VIDEO" : item.media_type === 8 ? "CAROUSEL_ALBUM" : "IMAGE",
    hashtags: extractHashtags(item.caption?.text || ""),
  }));

  let profile: ProfileInfo | undefined;
  try {
    const profileRes = await fetch(
      `https://instagram120.p.rapidapi.com/api/instagram/profile?username=${username}`,
      { method: "GET", headers }
    );
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      const u = profileData.data?.user || profileData.data || profileData.user || profileData;
      profile = {
        username: u.username || username,
        fullName: u.full_name || u.fullName || "",
        followers: u.follower_count || u.edge_followed_by?.count || u.followers || 0,
        following: u.following_count || u.edge_follow?.count || u.following || 0,
        posts: u.media_count || u.edge_owner_to_timeline_media?.count || posts.length,
        bio: u.biography || u.bio || "",
        verified: u.is_verified || false,
        isBusinessAccount: u.is_business || false,
      };
    }
  } catch {}

  return { posts, profile };
}

// ── Source 2: instagram-scraper3 RapidAPI ─────────────────────────────────────
async function scrapeViaInstagramScraper3(username: string): Promise<ScrapeResult> {
  const headers = {
    "x-rapidapi-host": "instagram-scraper3.p.rapidapi.com",
    "x-rapidapi-key": RAPID_API_KEY,
  };

  const profileRes = await fetch(
    `https://instagram-scraper3.p.rapidapi.com/user/info?username=${username}`,
    { headers }
  );
  if (!profileRes.ok) throw new Error(`instagram-scraper3 profile: ${profileRes.status}`);
  const profileData = await profileRes.json();
  const u = profileData.user || profileData.data || profileData;

  const profile: ProfileInfo = {
    username: u.username || username,
    fullName: u.full_name || "",
    followers: u.follower_count || u.followers || 0,
    following: u.following_count || u.following || 0,
    posts: u.media_count || 0,
    bio: u.biography || "",
    verified: u.is_verified || false,
  };

  const postsRes = await fetch(
    `https://instagram-scraper3.p.rapidapi.com/user/posts?username=${username}&count=20`,
    { headers }
  );
  let posts: ScrapedPost[] = [];
  if (postsRes.ok) {
    const postsData = await postsRes.json();
    const items = postsData.items || postsData.data?.items || [];
    posts = items.map((item: any) => ({
      id: item.id || item.pk || String(Math.random()),
      caption: item.caption?.text || item.caption || "",
      likes: item.like_count || 0,
      comments: item.comment_count || 0,
      views: item.view_count || item.play_count || 0,
      timestamp: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : undefined,
      url: `https://www.instagram.com/p/${item.code || item.shortcode}/`,
      hashtags: extractHashtags(item.caption?.text || ""),
    }));
  }

  return { posts, profile };
}

// ── Source 3: Apify basic (profile scraper only, no posts) ────────────────────
async function scrapeViaApifyBasic(username: string): Promise<ScrapeResult> {
  const items = await runApifyActor("apify/instagram-profile-scraper", {
    usernames: [username],
  });

  if (!items || items.length === 0) return { posts: [], profile: { username } };

  const p = items[0];
  const profile: ProfileInfo = {
    username: p.username || username,
    fullName: p.fullName || "",
    followers: p.followersCount || p.followedByCount || 0,
    following: p.followsCount || p.followingCount || 0,
    posts: p.postsCount || 0,
    bio: p.biography || p.description || "",
    verified: p.verified || false,
    isBusinessAccount: p.isBusinessAccount || false,
    profilePicUrl: p.profilePicUrl || "",
  };

  const posts: ScrapedPost[] = (p.latestPosts || p.posts || []).map((post: any) => ({
    id: post.id || post.shortCode || String(Math.random()),
    caption: post.caption || post.text || "",
    likes: post.likesCount || post.likes || 0,
    comments: post.commentsCount || post.comments || 0,
    views: post.videoViewCount || post.playsCount || 0,
    timestamp: post.timestamp || "",
    url: post.url || `https://www.instagram.com/p/${post.shortCode}/`,
    hashtags: extractHashtags(post.caption || ""),
  }));

  return { posts, profile };
}

// Full profile scrape: profile info + posts sorted by views
export async function scrapeInstagramProfileFull(username: string): Promise<{
  profile: ProfileInfo;
  topPosts: ScrapedPost[];
  recentPosts: ScrapedPost[];
}> {
  const { posts, profile } = await scrapeInstagramProfile(username);
  const topPosts = [...posts].sort((a, b) => ((b.views || b.likes || 0) - (a.views || a.likes || 0)));
  const recentPosts = [...posts].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  return {
    profile: profile || { username, followers: 0 },
    topPosts: topPosts.slice(0, 10),
    recentPosts: recentPosts.slice(0, 10),
  };
}

// ─── Facebook ─────────────────────────────────────────────────────────────────

export async function searchFacebookGroups(query: string): Promise<ScrapeResult> {
  if (!RAPID_API_KEY) return { posts: [] };
  const res = await fetch(
    `https://facebook-scraper3.p.rapidapi.com/search/groups?query=${encodeURIComponent(query)}`,
    {
      headers: {
        "x-rapidapi-host": "facebook-scraper3.p.rapidapi.com",
        "x-rapidapi-key": RAPID_API_KEY,
      },
    }
  );
  if (!res.ok) throw new Error(`Facebook scrape failed: ${res.status}`);
  const data = await res.json();
  const posts: ScrapedPost[] = (data.data || []).map((item: any) => ({
    id: item.id || String(Math.random()),
    caption: item.name || item.description,
    url: item.url,
  }));
  return { posts };
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

export async function scrapeYouTubeChannel(channelId: string): Promise<ScrapeResult> {
  if (!RAPID_API_KEY) return { posts: [] };
  const res = await fetch("https://youtube138.p.rapidapi.com/channel/videos/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": "youtube138.p.rapidapi.com",
      "x-rapidapi-key": RAPID_API_KEY,
    },
    body: JSON.stringify({ id: channelId, filter: "videos_latest", cursor: "", hl: "en", gl: "US" }),
  });
  if (!res.ok) throw new Error(`YouTube scrape failed: ${res.status}`);
  const data = await res.json();
  const posts: ScrapedPost[] = (data.contents || []).map((item: any) => {
    const v = item.video || item;
    return {
      id: v.videoId || String(Math.random()),
      caption: v.title,
      views: v.stats?.views,
      likes: v.stats?.likes,
      timestamp: v.publishedTimeText,
      url: `https://youtube.com/watch?v=${v.videoId}`,
    };
  });
  return { posts };
}

// ─── LinkedIn ─────────────────────────────────────────────────────────────────

export async function scrapeLinkedInProfile(username: string): Promise<ScrapeResult> {
  if (!RAPID_API_KEY) return { posts: [], profile: { username } };
  try {
    const res = await fetch(
      `https://linkedin-data-api.p.rapidapi.com/get-profile-data-by-url?url=https://www.linkedin.com/in/${username}/`,
      {
        headers: {
          "x-rapidapi-host": "linkedin-data-api.p.rapidapi.com",
          "x-rapidapi-key": RAPID_API_KEY,
        },
      }
    );
    if (!res.ok) throw new Error(`LinkedIn profile: ${res.status}`);
    const data = await res.json();
    const profile: ProfileInfo = {
      username: data.username || username,
      fullName: data.firstName ? `${data.firstName} ${data.lastName}` : username,
      followers: data.followerCount || data.connections || 0,
      posts: data.postsCount || 0,
      bio: data.summary || data.headline || "",
    };
    return { posts: [], profile };
  } catch (e: any) {
    console.warn(`[scraper] LinkedIn profile failed: ${e.message}`);
    return { posts: [], profile: { username } };
  }
}

export async function scrapeLinkedInCompany(domain: string): Promise<ScrapeResult> {
  if (!RAPID_API_KEY) return { posts: [] };
  const res = await fetch(
    `https://linkedin-data-api.p.rapidapi.com/get-company-by-domain?domain=${encodeURIComponent(domain)}`,
    {
      headers: {
        "x-rapidapi-host": "linkedin-data-api.p.rapidapi.com",
        "x-rapidapi-key": RAPID_API_KEY,
      },
    }
  );
  if (!res.ok) throw new Error(`LinkedIn scrape failed: ${res.status}`);
  const data = await res.json();
  const company = data.data || data;
  return {
    posts: [],
    profile: {
      username: company.name || domain,
      followers: company.followerCount,
      bio: company.description,
    },
  };
}

// ─── Apify ────────────────────────────────────────────────────────────────────

export async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>
): Promise<any[]> {
  if (!APIFY_TOKEN) throw new Error("APIFY_TOKEN not configured");

  // 25s timeout on the start call
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let startData: any;
  try {
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (!startRes.ok) {
      const errText = await startRes.text();
      throw new Error(`Apify start failed (${startRes.status}): ${errText.substring(0, 200)}`);
    }
    startData = await startRes.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") throw new Error(`Apify actor ${actorId} start timed out after 25s`);
    throw err;
  }

  const runId = startData.data?.id;
  if (!runId) throw new Error("Apify: no run ID returned");

  // Poll for completion (max 75s = 25 × 3s)
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const statusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
      );
      if (!statusRes.ok) continue;
      const { data: status } = await statusRes.json();
      if (status?.status === "SUCCEEDED") break;
      if (status?.status === "FAILED" || status?.status === "ABORTED") {
        throw new Error(`Apify actor ${actorId} run ${status.status}`);
      }
      console.log(`[Apify] ${actorId} run status: ${status?.status} (${i + 1}/25)`);
      // If still running at attempt 24, return whatever data exists (partial)
      if (i === 24) {
        console.warn(`[Apify] ${actorId} timed out — fetching partial results`);
      }
    } catch (pollErr: any) {
      console.warn(`[Apify] Poll error: ${pollErr.message}`);
    }
  }

  const resultsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=50`
  );
  if (!resultsRes.ok) throw new Error(`Apify results fetch failed: ${resultsRes.status}`);
  const items = await resultsRes.json();
  return Array.isArray(items) ? items : [];
}

