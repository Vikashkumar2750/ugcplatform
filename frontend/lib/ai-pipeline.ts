/**
 * Core AI pipeline — runs on the CLIENT using the user's own API keys.
 * Anthropic key: from localStorage (passed via headers)
 * Apify key: from localStorage (for scraping)
 *
 * This file contains the 4 main phases:
 * Phase 1: Profile Audit (Apify scrape → Claude analysis)
 * Phase 2: Competitor Analysis (Apify scrape → Claude comparison)
 * Phase 3: Trend Research (Claude synthesis)
 * Phase 4: 7-Day Content Pipeline (Claude script generation)
 */

export interface ProfileData {
  handle: string;
  platform: string;
  followers: number;
  following: number;
  totalPosts: number;
  avgLikes: number;
  avgComments: number;
  avgViews: number;
  engagementRate: number;
  recentPosts: Post[];
  bio: string;
}

export interface Post {
  caption: string;
  likes: number;
  comments: number;
  views?: number;
  type: "reel" | "post" | "carousel";
  hashtags: string[];
  date: string;
}

export interface AuditResult {
  engagementRate: string;
  benchmark: string;
  strengths: string[];
  weaknesses: string[];
  diagnosis: Record<string, string>;
  score: number;
}

export interface CompetitorResult {
  handle: string;
  er: number;
  followers: number;
  whatTheyDoRight: string[];
  keyDifferences: string[];
}

export interface TrendResult {
  trendingFormats: Array<{ format: string; growth: string; type: string }>;
  trendingHashtags: string[];
  trendingTopics: string[];
  bestPostingTimes: string[];
}

export interface Script {
  day: string;
  format: string;
  topic: string;
  hook: string;
  triggerType: string;
  script: string;
  caption: string;
}

export interface AnalysisResult {
  audit?: AuditResult;
  competitors?: CompetitorResult[];
  trends?: TrendResult;
  scripts?: Script[];
  nicheDiscovery?: {
    suggestedNiche: string;
    targetAudience: string;
    competitors: string[];
    contentTypes: string[];
  };
}

// ─────────────────────────────────────────────
// Phase 1: Profile Audit
// ─────────────────────────────────────────────

export async function runProfileAudit(
  profileUrl: string,
  platform: string,
  apifyKey: string,
  anthropicKey: string,
  language: "hi" | "en"
): Promise<AuditResult> {
  // 1. Scrape profile via Apify
  const profileData = await scrapeProfile(profileUrl, platform, apifyKey);

  // 2. Send to Claude for analysis
  const prompt = buildAuditPrompt(profileData, language);
  const response = await callClaude(anthropicKey, prompt);

  return parseAuditResponse(response, profileData);
}

async function scrapeProfile(url: string, platform: string, apifyKey: string): Promise<ProfileData> {
  const ACTOR_IDS: Record<string, string> = {
    instagram: "apify~instagram-profile-scraper",
    youtube: "apify~youtube-channel-scraper",
    facebook: "apify~facebook-pages-scraper",
  };

  const actorId = ACTOR_IDS[platform.toLowerCase()] || ACTOR_IDS.instagram;

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyKey}&timeout=60`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url }],
        resultsLimit: 20,
      }),
    }
  );

  if (!runRes.ok) {
    throw new Error(`Apify scrape failed: ${runRes.status}`);
  }

  const data = await runRes.json();
  return normalizeProfileData(data[0] || {}, platform);
}

function normalizeProfileData(raw: any, platform: string): ProfileData {
  // Normalize across platforms
  return {
    handle: raw.username || raw.channelName || raw.name || "unknown",
    platform,
    followers: raw.followersCount || raw.subscriberCount || raw.likes || 0,
    following: raw.followingCount || 0,
    totalPosts: raw.postsCount || raw.videoCount || 0,
    avgLikes: raw.latestPosts
      ? raw.latestPosts.reduce((s: number, p: any) => s + (p.likesCount || 0), 0) / Math.max(raw.latestPosts.length, 1)
      : 0,
    avgComments: raw.latestPosts
      ? raw.latestPosts.reduce((s: number, p: any) => s + (p.commentsCount || 0), 0) / Math.max(raw.latestPosts.length, 1)
      : 0,
    avgViews: raw.latestPosts
      ? raw.latestPosts.reduce((s: number, p: any) => s + (p.videoViewCount || p.videoPlayCount || 0), 0) / Math.max(raw.latestPosts.length, 1)
      : 0,
    engagementRate:
      raw.followersCount > 0
        ? ((raw.latestPosts?.reduce((s: number, p: any) => s + (p.likesCount || 0) + (p.commentsCount || 0), 0) || 0) /
            Math.max(raw.latestPosts?.length || 1, 1) /
            raw.followersCount) *
          100
        : 0,
    recentPosts: (raw.latestPosts || []).slice(0, 20).map((p: any) => ({
      caption: p.caption || p.title || "",
      likes: p.likesCount || 0,
      comments: p.commentsCount || 0,
      views: p.videoViewCount || p.videoPlayCount || 0,
      type: p.type === "Video" ? "reel" : p.type === "Sidecar" ? "carousel" : "post",
      hashtags: extractHashtags(p.caption || ""),
      date: p.timestamp || p.publishedAt || "",
    })),
    bio: raw.biography || raw.description || "",
  };
}

function extractHashtags(text: string): string[] {
  return (text.match(/#\w+/g) || []).map(h => h.toLowerCase());
}

function buildAuditPrompt(data: ProfileData, language: "hi" | "en"): string {
  const langInstruction = language === "hi"
    ? "Respond in Hindi/Hinglish (mix of Hindi and English). Keep it conversational and relatable for Indian creators."
    : "Respond in English.";

  return `You are a world-class social media strategist specializing in Indian content creators.

Analyze this ${data.platform} profile and provide a detailed audit.

PROFILE DATA:
- Handle: ${data.handle}
- Followers: ${data.followers.toLocaleString()}
- Following: ${data.following.toLocaleString()}
- Total Posts: ${data.totalPosts}
- Avg Likes per post: ${Math.round(data.avgLikes)}
- Avg Comments per post: ${Math.round(data.avgComments)}
- Avg Views per post: ${Math.round(data.avgViews)}
- Engagement Rate: ${data.engagementRate.toFixed(2)}%
- Bio: "${data.bio}"

RECENT POST SAMPLES (last ${data.recentPosts.length} posts):
${data.recentPosts.slice(0, 5).map((p, i) =>
  `Post ${i+1}: Type=${p.type}, Likes=${p.likes}, Comments=${p.comments}, Views=${p.views || 'N/A'}, Hashtags=${p.hashtags.slice(0, 5).join(', ')}, Caption snippet="${p.caption.slice(0, 100)}"`
).join('\n')}

${langInstruction}

Return a JSON response with this exact structure:
{
  "engagementRate": "${data.engagementRate.toFixed(2)}%",
  "benchmark": "one line explaining if ER is good/bad with Indian creator context",
  "score": <number 0-100>,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3", "weakness 4"],
  "diagnosis": {
    "hookQuality": "assessment of hook quality in first 3 seconds",
    "ctaPresence": "assessment of call-to-action usage",
    "consistency": "assessment of posting consistency",
    "contentVariety": "assessment of content format variety",
    "hashtagStrategy": "assessment of hashtag strategy",
    "captionDepth": "assessment of caption quality and depth",
    "engagementLoop": "assessment of comment reply and community engagement"
  }
}

Only return valid JSON. No markdown, no extra text.`;
}

// ─────────────────────────────────────────────
// Phase 2: Competitor Analysis
// ─────────────────────────────────────────────

export async function runCompetitorAnalysis(
  competitorUrls: string[],
  myProfile: ProfileData,
  apifyKey: string,
  anthropicKey: string,
  language: "hi" | "en"
): Promise<CompetitorResult[]> {
  const results: CompetitorResult[] = [];

  for (const url of competitorUrls.filter(u => u.trim())) {
    const platform = detectPlatform(url);
    if (!platform) continue;

    const compData = await scrapeProfile(url, platform, apifyKey);
    const prompt = buildCompetitorPrompt(myProfile, compData, language);
    const response = await callClaude(anthropicKey, prompt);
    const parsed = JSON.parse(response);

    results.push({
      handle: compData.handle,
      er: compData.engagementRate,
      followers: compData.followers,
      whatTheyDoRight: parsed.whatTheyDoRight || [],
      keyDifferences: parsed.keyDifferences || [],
    });
  }

  return results;
}

function buildCompetitorPrompt(mine: ProfileData, comp: ProfileData, language: "hi" | "en"): string {
  const langInstruction = language === "hi"
    ? "Respond in Hindi/Hinglish."
    : "Respond in English.";

  return `Compare two ${mine.platform} creator profiles and explain exactly what the competitor does better.

MY PROFILE:
- Handle: ${mine.handle}, ER: ${mine.engagementRate.toFixed(2)}%, Followers: ${mine.followers}

COMPETITOR PROFILE:
- Handle: ${comp.handle}, ER: ${comp.engagementRate.toFixed(2)}%, Followers: ${comp.followers}
- Avg Likes: ${Math.round(comp.avgLikes)}, Avg Comments: ${Math.round(comp.avgComments)}

${langInstruction}

Return JSON:
{
  "whatTheyDoRight": ["specific thing 1", "specific thing 2", "specific thing 3", "specific thing 4"],
  "keyDifferences": ["difference 1", "difference 2", "difference 3"]
}

Only return valid JSON.`;
}

// ─────────────────────────────────────────────
// Phase 3: Trend Research
// ─────────────────────────────────────────────

export async function runTrendResearch(
  niche: string,
  platform: string,
  anthropicKey: string,
  language: "hi" | "en"
): Promise<TrendResult> {
  const prompt = `You are a social media trend expert for Indian creators.

Find current trending content opportunities for:
- Niche: ${niche}
- Platform: ${platform}
- Target Market: India
- Month: ${new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })}

${language === "hi" ? "Respond with Hindi/Hinglish descriptions." : "Respond in English."}

Return JSON:
{
  "trendingFormats": [
    {"format": "format name", "growth": "+X%", "type": "Reel/Carousel/Story"},
    ...5 items
  ],
  "trendingHashtags": ["#tag1", "#tag2", ...10 tags],
  "trendingTopics": ["topic 1", "topic 2", "topic 3", "topic 4", "topic 5"],
  "bestPostingTimes": ["Day 7-9 PM IST", ...]
}

Only return valid JSON.`;

  const response = await callClaude(anthropicKey, prompt);
  return JSON.parse(response);
}

// ─────────────────────────────────────────────
// Phase 4: 7-Day Script Generator
// ─────────────────────────────────────────────

export async function runScriptGeneration(
  profileData: ProfileData,
  auditResult: AuditResult,
  niche: string,
  language: "hi" | "en",
  anthropicKey: string,
  count: number = 7
): Promise<Script[]> {
  const langInstruction = language === "hi"
    ? "Write all scripts and captions in Hindi/Hinglish (conversational, relatable Indian tone). Use emojis."
    : "Write in English, keeping it relatable for Indian audiences.";

  const prompt = `You are a viral content strategist for Indian ${niche} creators on ${profileData.platform}.

CREATOR CONTEXT:
- Handle: ${profileData.handle}
- Niche: ${niche}
- Top Issues: ${auditResult.weaknesses.slice(0, 3).join(', ')}

${langInstruction}

Generate ${count} unique, shoot-ready video scripts for a 7-day content plan. Each script must use a different psychological hook trigger (Curiosity, FOMO, Relatability, Authority, Fear, Aspiration, Shock).

Return JSON array with ${count} items:
[
  {
    "day": "Din 1 (Monday)",
    "format": "Reel",
    "topic": "specific topic",
    "hook": "exact opening line — the first thing they say on camera",
    "triggerType": "Curiosity Gap",
    "script": "full shot-by-shot script with timestamps",
    "caption": "full caption with hashtags"
  },
  ...
]

Only return valid JSON array.`;

  const response = await callClaude(anthropicKey, prompt, 4000);
  return JSON.parse(response);
}

// ─────────────────────────────────────────────
// Niche Discovery
// ─────────────────────────────────────────────

export async function runNicheDiscovery(
  profileUrl: string,
  profession: string,
  resume: string,
  apifyKey: string,
  anthropicKey: string,
  language: "hi" | "en"
): Promise<AnalysisResult["nicheDiscovery"]> {
  const platform = detectPlatform(profileUrl) || "instagram";
  let profileData: Partial<ProfileData> = {};

  try {
    profileData = await scrapeProfile(profileUrl, platform, apifyKey);
  } catch {
    // If scrape fails, proceed with just profession data
  }

  const langInstruction = language === "hi"
    ? "Respond in Hindi/Hinglish."
    : "Respond in English.";

  const prompt = `You are a niche strategy expert for Indian content creators.

Based on the following information, identify the perfect content niche and strategy:

CREATOR'S PROFESSION/EXPERIENCE:
${profession}

${resume ? `ADDITIONAL BACKGROUND:\n${resume}\n` : ""}
${profileData.bio ? `CURRENT BIO: "${profileData.bio}"` : ""}
${profileData.followers ? `CURRENT FOLLOWERS: ${profileData.followers}` : ""}

TARGET MARKET: India

${langInstruction}

Return JSON:
{
  "suggestedNiche": "specific niche name",
  "targetAudience": "detailed description of ideal audience",
  "competitors": ["@handle1", "@handle2", "@handle3"],
  "contentTypes": ["content type 1", "content type 2", "content type 3", "content type 4"]
}

Only return valid JSON.`;

  const response = await callClaude(anthropicKey, prompt);
  return JSON.parse(response);
}

// ─────────────────────────────────────────────
// Claude API wrapper
// ─────────────────────────────────────────────

async function callClaude(apiKey: string, prompt: string, maxTokens: number = 2000): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("INVALID_ANTHROPIC_KEY");
    if (res.status === 429) throw new Error("RATE_LIMIT");
    throw new Error(err.error?.message || `Claude API error: ${res.status}`);
  }

  const data = await res.json();
  return data.content[0]?.text || "{}";
}

function parseAuditResponse(response: string, profileData: ProfileData): AuditResult {
  try {
    return JSON.parse(response);
  } catch {
    // Fallback if JSON parse fails
    return {
      engagementRate: `${profileData.engagementRate.toFixed(2)}%`,
      benchmark: profileData.engagementRate > 3
        ? "Zabardast! 3%+ engagement rate bahut achha hai"
        : profileData.engagementRate > 1
        ? "Theek hai — 1–3% average range mein hai"
        : "Neeche hai — improvements zaroori hain",
      strengths: ["Consistent posting activity"],
      weaknesses: ["Analysis partially failed — retry with valid API keys"],
      diagnosis: {},
      score: Math.round(Math.min(profileData.engagementRate * 15, 100)),
    };
  }
}

function detectPlatform(url: string): string | null {
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/facebook\.com/i.test(url)) return "facebook";
  return null;
}
