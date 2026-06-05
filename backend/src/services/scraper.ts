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
  const res = await fetch("https://instagram120.p.rapidapi.com/api/instagram/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": "instagram120.p.rapidapi.com",
      "x-rapidapi-key": RAPID_API_KEY,
    },
    body: JSON.stringify({ username, maxId: "" }),
  });

  if (!res.ok) throw new Error(`Instagram scrape failed: ${res.status}`);
  const data = await res.json();

  const posts: ScrapedPost[] = (data.data?.items || []).map((item: any) => ({
    id: item.id || item.pk,
    caption: item.caption?.text,
    likes: item.like_count,
    comments: item.comment_count,
    views: item.view_count,
    timestamp: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : undefined,
    mediaUrl: item.image_versions2?.candidates?.[0]?.url,
  }));

  return { posts };
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
