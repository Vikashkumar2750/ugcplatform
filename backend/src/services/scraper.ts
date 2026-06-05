// Scraper service — uses RapidAPI for social media + Apify for advanced scraping

const RAPID_API_KEY = process.env.RAPIDAPI_KEY!;
const APIFY_TOKEN = process.env.APIFY_TOKEN!;

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

// ─── Instagram ────────────────────────────────────────────────────────────────

export async function scrapeInstagramProfile(username: string): Promise<ScrapeResult> {
  // Fetch posts
  const postsRes = await fetch("https://instagram120.p.rapidapi.com/api/instagram/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": "instagram120.p.rapidapi.com",
      "x-rapidapi-key": RAPID_API_KEY,
    },
    body: JSON.stringify({ username, maxId: "" }),
  });

  if (!postsRes.ok) throw new Error(`Instagram posts scrape failed: ${postsRes.status}`);
  const postsData = await postsRes.json();

  const posts: ScrapedPost[] = (postsData.data?.items || []).map((item: any) => ({
    id: item.id || item.pk,
    caption: item.caption?.text,
    likes: item.like_count || 0,
    comments: item.comment_count || 0,
    views: item.view_count || item.play_count || 0,
    timestamp: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : undefined,
    mediaUrl: item.image_versions2?.candidates?.[0]?.url,
    url: `https://www.instagram.com/p/${item.code || item.shortcode}/`,
  }));

  // Fetch profile info separately
  let profile: ProfileInfo | undefined;
  try {
    const profileRes = await fetch(`https://instagram120.p.rapidapi.com/api/instagram/profile?username=${username}`, {
      method: "GET",
      headers: {
        "x-rapidapi-host": "instagram120.p.rapidapi.com",
        "x-rapidapi-key": RAPID_API_KEY,
      },
    });
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      const u = profileData.data?.user || profileData.data || profileData;
      profile = {
        username: u.username || username,
        followers: u.follower_count || u.followers || u.edge_followed_by?.count || 0,
        following: u.following_count || u.following || u.edge_follow?.count || 0,
        posts: u.media_count || u.posts || u.edge_owner_to_timeline_media?.count || posts.length,
        bio: u.biography || u.bio || "",
      };
    }
  } catch (profileErr: any) {
    console.warn(`[scraper] Profile info fetch failed: ${profileErr.message}`);
  }

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
  const res = await fetch(
    `https://facebook-scraper3.p.rapidapi.com/search/groups?query=${encodeURIComponent(query)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
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
  const res = await fetch("https://youtube138.p.rapidapi.com/channel/videos/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": "youtube138.p.rapidapi.com",
      "x-rapidapi-key": RAPID_API_KEY,
    },
    body: JSON.stringify({
      id: channelId,
      filter: "videos_latest",
      cursor: "",
      hl: "en",
      gl: "US",
    }),
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

export async function scrapeLinkedInCompany(domain: string): Promise<ScrapeResult> {
  const res = await fetch(
    `https://linkedin-data-api.p.rapidapi.com/get-company-by-domain?domain=${encodeURIComponent(domain)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
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
// For advanced scraping tasks (Instagram profiles, competitor analysis)

export async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>
): Promise<any[]> {
  // Start run
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, maxItems: 50 }),
    }
  );

  if (!startRes.ok) throw new Error(`Apify start failed: ${startRes.status}`);
  const { data: run } = await startRes.json();
  const runId = run.id;

  // Poll for completion (max 30s)
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    const { data: status } = await statusRes.json();
    if (status.status === "SUCCEEDED") break;
    if (status.status === "FAILED") throw new Error("Apify actor run failed");
  }

  // Fetch results
  const resultsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=50`
  );
  const items = await resultsRes.json();
  return Array.isArray(items) ? items : [];
}
