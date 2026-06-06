// Scraper service — Multi-source with automatic fallbacks
// Priority: RapidAPI (instagram120) → RapidAPI alt → Apify → AI-only

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
}

export interface ProfileInfo {
  username: string;
  followers?: number;
  following?: number;
  posts?: number;
  bio?: string;
}

// ─── Instagram — Multiple API sources with fallback ──────────────────────────

export async function scrapeInstagramProfile(username: string): Promise<ScrapeResult> {
  // Source 1: instagram120 RapidAPI (user's primary)
  if (RAPID_API_KEY) {
    try {
      const result = await scrapeViaInstagram120(username);
      if (result.posts.length > 0 || result.profile) {
        console.log(`[scraper] Instagram120 success for @${username}: ${result.posts.length} posts`);
        return result;
      }
    } catch (e: any) {
      console.warn(`[scraper] instagram120 failed for @${username}: ${e.message}`);
    }

    // Source 2: instagram-scraper3 RapidAPI (alternate)
    try {
      const result = await scrapeViaInstagramScraper3(username);
      if (result.posts.length > 0 || result.profile) {
        console.log(`[scraper] InstagramScraper3 success for @${username}`);
        return result;
      }
    } catch (e: any) {
      console.warn(`[scraper] instagram-scraper3 failed for @${username}: ${e.message}`);
    }
  }

  // Source 3: Apify (if token available)
  if (APIFY_TOKEN) {
    try {
      const result = await scrapeViaApify(username);
      if (result.posts.length > 0 || result.profile) {
        console.log(`[scraper] Apify success for @${username}`);
        return result;
      }
    } catch (e: any) {
      console.warn(`[scraper] Apify failed for @${username}: ${e.message}`);
    }
  }

  console.warn(`[scraper] All sources failed for @${username} — returning empty`);
  return { posts: [], profile: { username } };
}

// ── Source 1: instagram120 RapidAPI ──────────────────────────────────────────
async function scrapeViaInstagram120(username: string): Promise<ScrapeResult> {
  const headers = {
    "Content-Type": "application/json",
    "x-rapidapi-host": "instagram120.p.rapidapi.com",
    "x-rapidapi-key": RAPID_API_KEY,
  };

  // Fetch posts
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
    mediaUrl: item.image_versions2?.candidates?.[0]?.url || item.thumbnail_url,
    url: `https://www.instagram.com/p/${item.code || item.shortcode}/`,
  }));

  // Fetch profile
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
        followers: u.follower_count || u.edge_followed_by?.count || u.followers || 0,
        following: u.following_count || u.edge_follow?.count || u.following || 0,
        posts: u.media_count || u.edge_owner_to_timeline_media?.count || posts.length,
        bio: u.biography || u.bio || "",
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
    followers: u.follower_count || u.followers || 0,
    following: u.following_count || u.following || 0,
    posts: u.media_count || 0,
    bio: u.biography || "",
  };

  // Fetch posts
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
    }));
  }

  return { posts, profile };
}

// ── Source 3: Apify Instagram Scraper ────────────────────────────────────────
async function scrapeViaApify(username: string): Promise<ScrapeResult> {
  // Use the correct Apify actor for Instagram profiles
  // apify/instagram-profile-scraper is the official maintained actor
  const items = await runApifyActor("apify/instagram-profile-scraper", {
    usernames: [username],
    resultsLimit: 20,
  });

  if (!items || items.length === 0) return { posts: [], profile: { username } };

  const profileItem = items[0];
  const profile: ProfileInfo = {
    username: profileItem.username || username,
    followers: profileItem.followersCount || profileItem.followedByCount || 0,
    following: profileItem.followsCount || profileItem.followingCount || 0,
    posts: profileItem.postsCount || 0,
    bio: profileItem.biography || profileItem.description || "",
  };

  const posts: ScrapedPost[] = (profileItem.latestPosts || profileItem.posts || [])
    .map((p: any) => ({
      id: p.id || p.shortCode || String(Math.random()),
      caption: p.caption || p.text || "",
      likes: p.likesCount || p.likes || 0,
      comments: p.commentsCount || p.comments || 0,
      views: p.videoViewCount || p.playsCount || p.videoPlayCount || 0,
      timestamp: p.timestamp || p.ownerFullName,
      url: p.url || `https://www.instagram.com/p/${p.shortCode}/`,
    }));

  return { posts, profile };
}

// Full profile scrape: profile info + posts sorted by views (most viral first)
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
// Generic Apify actor runner with 60s timeout

export async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>
): Promise<any[]> {
  if (!APIFY_TOKEN) throw new Error("APIFY_TOKEN not configured");

  // Start run
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Apify start failed (${startRes.status}): ${errText.substring(0, 200)}`);
  }
  const startData = await startRes.json();
  const runId = startData.data?.id;
  if (!runId) throw new Error("Apify: no run ID returned");

  // Poll for completion (max 60s = 20 × 3s)
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    if (!statusRes.ok) continue;
    const { data: status } = await statusRes.json();
    if (status?.status === "SUCCEEDED") break;
    if (status?.status === "FAILED" || status?.status === "ABORTED") {
      throw new Error(`Apify actor ${actorId} run ${status.status}`);
    }
    console.log(`[Apify] Run ${runId} status: ${status?.status} (attempt ${i + 1}/20)`);
  }

  // Fetch results
  const resultsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=50`
  );
  if (!resultsRes.ok) throw new Error(`Apify results fetch failed: ${resultsRes.status}`);
  const items = await resultsRes.json();
  return Array.isArray(items) ? items : [];
}
