import { Router, Request, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { callLLM } from "../services/llm";
import { scrapeInstagramProfile, runApifyActor } from "../services/scraper";
import {
  fetchConnectedInstagramData,
  fetchConnectedFacebookData,
  RealProfileData,
} from "../services/meta-data";
import { supabase } from "../lib/supabase";

const router = Router();
router.use(requireAuth);

// ─── Helper: extract JSON from LLM response ──────────────────────────────────
function extractJSON(text: string): unknown {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  try { return JSON.parse(text.trim()); } catch {}
  return null;
}

// ─── Helper: get username from URL ───────────────────────────────────────────
function extractUsername(url: string, platform: string): string {
  if (platform === "instagram") {
    return url.replace(/.*instagram\.com\//i, "").replace(/\/$/, "").split("/")[0].replace("@", "");
  }
  if (platform === "facebook") {
    return url.replace(/.*facebook\.com\//i, "").replace(/\/$/, "").split("/")[0].replace("@", "");
  }
  if (platform === "youtube") {
    const match = url.match(/@([^/?\s]+)/);
    return match ? match[1] : "";
  }
  return "";
}

// ─── Helper: get real data from connected accounts OR scraper fallback ────────
async function getRealProfileData(
  userId: string,
  platform: string,
  profileUrl: string
): Promise<{ data: RealProfileData | null; source: string }> {
  const username = extractUsername(profileUrl, platform);

  // 1. Try Meta Graph API (connected account — most reliable, free)
  if (platform === "instagram") {
    const data = await fetchConnectedInstagramData(userId, username);
    if (data) return { data, source: "meta_graph_api" };
  }
  if (platform === "facebook") {
    const data = await fetchConnectedFacebookData(userId, username);
    if (data) return { data, source: "meta_graph_api" };
  }

  // 2. Fallback: RapidAPI scraper
  try {
    if (platform === "instagram" && username) {
      const result = await scrapeInstagramProfile(username);
      if (result.posts.length > 0) {
        const posts = result.posts.slice(0, 20);
        const avgLikes = Math.round(posts.reduce((s, p) => s + (p.likes || 0), 0) / posts.length);
        const avgComments = Math.round(posts.reduce((s, p) => s + (p.comments || 0), 0) / posts.length);
        return {
          data: {
            username,
            followers: result.profile?.followers || 0,
            following: result.profile?.following || 0,
            mediaCount: result.profile?.posts || posts.length,
            biography: result.profile?.bio,
            avgLikes,
            avgComments,
            engagementRate: 0,
            posts: posts.map(p => ({
              id: p.id,
              caption: p.caption,
              likes: p.likes || 0,
              comments: p.comments || 0,
              mediaType: "IMAGE",
              timestamp: p.timestamp || "",
              views: p.views,
            })),
            platform: "instagram",
          },
          source: "rapidapi",
        };
      }
    }
  } catch (scrapeErr: any) {
    console.warn(`[analyze] RapidAPI scrape skipped: ${scrapeErr.message}`);
  }

  // 3. No data — LLM will work with URL only (AI general knowledge)
  return { data: null, source: "url_only" };
}

// ─── POST /api/analyze/audit ──────────────────────────────────────────────────
router.post("/audit", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { profileUrl, platform, niche, language } = req.body;

  if (!profileUrl) return res.status(400).json({ error: "profileUrl is required" });

  try {
    const { data: realData, source } = await getRealProfileData(userId, platform, profileUrl);
    console.log(`[audit] Data source: ${source}, posts: ${realData?.posts?.length || 0}`);

    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? "Tu ek expert social media content strategist hai jo Indian creators ke liye kaam karta hai. Hinglish mein jawab de. SIRF valid JSON return kar — koi extra text mat likho."
      : "You are an expert social media content strategist for Indian creators. Return ONLY valid JSON — no extra text.";

    const dataSection = realData
      ? `
REAL ACCOUNT DATA (use these exact numbers):
- Username: @${realData.username}
- Followers: ${realData.followers.toLocaleString()}
- Following: ${realData.following.toLocaleString()}
- Total Posts: ${realData.mediaCount}
- Avg Likes per post: ${realData.avgLikes}
- Avg Comments per post: ${realData.avgComments}
- Engagement Rate: ${realData.engagementRate}%
- Bio: ${realData.biography || "Not available"}

RECENT POSTS (last ${realData.posts.length} posts):
${realData.posts.slice(0, 10).map((p, i) =>
  `Post ${i + 1}: ${p.mediaType} | Likes: ${p.likes} | Comments: ${p.comments}${p.saves ? ` | Saves: ${p.saves}` : ""}${p.reach ? ` | Reach: ${p.reach}` : ""} | Caption: "${(p.caption || "").substring(0, 100)}"`
).join("\n")}`
      : `Profile URL: ${profileUrl}\n(No direct data available — analyze based on URL and niche)`;

    const prompt = `Analyze this ${platform} creator and provide a detailed audit:

${dataSection}
Niche: ${niche || "Not specified"}
Data Source: ${source}

Return JSON:
{
  "engagementRate": "${realData?.engagementRate || 0}%",
  "benchmark": "brief context — is this ER good/bad for ${niche} niche?",
  "followerCount": "${realData?.followers?.toLocaleString() || "Unknown"}",
  "avgLikes": "${realData?.avgLikes || "Unknown"}",
  "avgComments": "${realData?.avgComments || "Unknown"}",
  "postsAnalyzed": ${realData?.posts?.length || 0},
  "dataSource": "${source}",
  "strengths": ["strength 1 based on REAL data", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1 based on REAL data", "weakness 2", "weakness 3", "weakness 4"],
  "diagnosis": {
    "hookQuality": "assessment based on captions",
    "ctaPresence": "assessment",
    "consistency": "assessment based on post timestamps",
    "contentVariety": "assessment based on media types",
    "hashtagStrategy": "assessment",
    "captionDepth": "assessment based on actual captions",
    "engagementLoop": "assessment"
  },
  "overallScore": 75,
  "topRecommendation": "single most impactful action based on actual data"
}`;

    const llmResult = await callLLM({ userId, endpoint: "audit", prompt, systemPrompt });
    const auditData = extractJSON(llmResult.text) || { raw: llmResult.text };

    // Save to analysis_results table
    const { data: saved } = await supabase.from("analysis_results").insert({
      user_id: userId,
      profile_url: profileUrl,
      platform,
      niche: niche || null,
      result_type: "audit",
      result_data: auditData,
      data_source: source,
    }).select("id").single();

    return res.json({
      success: true,
      audit: auditData,
      dataSource: source,
      analysisId: saved?.id,
      _meta: { provider: llmResult.provider, model: llmResult.model, dataSource: source }
    });
  } catch (err: any) {
    console.error("[/api/analyze/audit]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/analyze/competitors ───────────────────────────────────────────
router.post("/competitors", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { platform, niche, language, competitors, profession, profileUrl } = req.body;

  try {
    // Get user's own real data first (for comparison baseline)
    let ownData: RealProfileData | null = null;
    if (profileUrl) {
      const { data } = await getRealProfileData(userId, platform, profileUrl);
      ownData = data;
    }

    // Scrape competitor data via RapidAPI
    let competitorData: any[] = [];
    if (competitors?.length) {
      try {
        if (platform === "instagram") {
          const usernames = competitors.map((url: string) => extractUsername(url, "instagram")).filter(Boolean);
          const results = await Promise.allSettled(
            usernames.slice(0, 3).map((u: string) => scrapeInstagramProfile(u))
          );
          competitorData = results
            .filter(r => r.status === "fulfilled")
            .flatMap((r: any) => r.value.posts.slice(0, 5));
        } else if (platform === "youtube") {
          try {
            competitorData = await runApifyActor("streamers/youtube-channel-scraper", {
              startUrls: competitors.slice(0, 3).map((url: string) => ({ url })),
              resultsLimit: 5,
            });
          } catch (apifyErr: any) {
            console.warn("[competitors] Apify skipped:", apifyErr.message);
          }
        }
      } catch (scrapeErr: any) {
        console.warn(`[competitors] Scrape skipped: ${scrapeErr.message}`);
      }
    }

    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? "Tu expert social media analyst hai. Hinglish mein jawab de. SIRF valid JSON return kar."
      : "You are an expert social media analyst. Return ONLY valid JSON.";

    const ownSection = ownData
      ? `USER'S OWN ACCOUNT (${ownData.username}): ${ownData.followers} followers, ${ownData.engagementRate}% ER, ${ownData.avgLikes} avg likes`
      : `User's platform: ${platform}, Niche: ${niche}`;

    const competitorSection = competitorData.length > 0
      ? `SCRAPED COMPETITOR DATA: ${JSON.stringify(competitorData.slice(0, 10), null, 2).substring(0, 2000)}`
      : `Known Competitor URLs: ${competitors?.join(", ") || "None provided"}\nProfession/Context: ${profession || "Not specified"}`;

    const prompt = `Analyze competitors for this ${platform} creator in the ${niche} niche:

${ownSection}

${competitorSection}

Return JSON:
{
  "competitors": [
    {
      "username": "@handle",
      "estimatedFollowers": "number",
      "engagementRate": "X%",
      "postingFrequency": "X/week",
      "hookStyle": "description of their hook strategy",
      "contentStyle": "description",
      "captionStyle": "short/long/etc",
      "topHashtags": ["#tag1", "#tag2"]
    }
  ],
  "keyInsights": ["insight based on real comparison", "insight 2", "insight 3"],
  "gapsToExploit": ["gap where user can win", "gap 2"],
  "userVsCompetitor": {
    "userStrength": "where user is ahead",
    "userWeakness": "where competitors are better",
    "quickWin": "one thing user can copy immediately"
  },
  "recommendedNiche": "${niche || "suggested niche"}",
  "recommendedSubNiche": "more specific sub-niche"
}`;

    const llmResult = await callLLM({ userId, endpoint: "competitors", prompt, systemPrompt });
    const data = extractJSON(llmResult.text) || { raw: llmResult.text };

    return res.json({
      success: true,
      competitors: data,
      _meta: { provider: llmResult.provider, model: llmResult.model }
    });
  } catch (err: any) {
    console.error("[/api/analyze/competitors]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/analyze/trends ─────────────────────────────────────────────────
router.post("/trends", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { platform, niche, language } = req.body;

  try {
    let trendData: unknown[] = [];
    try {
      if (platform === "youtube") {
        trendData = await runApifyActor("streamers/youtube-scraper", {
          searchKeywords: [`${niche} India 2025`],
          maxResults: 10,
        });
      } else {
        trendData = await runApifyActor("apify/instagram-scraper", {
          directUrls: [
            `https://www.instagram.com/explore/tags/${(niche || "India").toLowerCase().replace(/\s/g, "")}/`,
          ],
          resultsLimit: 15,
        });
      }
    } catch (scrapeErr: any) {
      console.warn(`[trends] Apify skipped: ${scrapeErr.message}`);
    }

    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? "Tu Indian social media trend expert hai. Hinglish mein examples do. SIRF valid JSON return kar."
      : "You are an Indian social media trend expert. Return ONLY valid JSON.";

    const currentMonth = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });

    const prompt = `Analyze trending content for ${platform} creators in India in the ${niche} niche (${currentMonth}):

${trendData.length > 0
  ? `Scraped Trend Data: ${JSON.stringify(trendData.slice(0, 10), null, 2).substring(0, 2000)}`
  : `No scraped data — use your knowledge of current Indian ${platform} trends for ${niche} niche.`
}

Return JSON:
{
  "trendingFormats": [
    { "format": "format name", "growth": "+X%", "type": "Reel/Carousel/Short/Video", "whyItWorks": "brief" }
  ],
  "trendingTopics": [
    { "topic": "topic name", "searchVolume": "High/Medium/Low", "competition": "High/Medium/Low" }
  ],
  "trendingHashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "trendingAudio": ["audio name 1 (if applicable)", "audio name 2"],
  "seasonalOpportunity": "current ${currentMonth} specific opportunity for Indian ${niche} creators",
  "viralHookFormulas": [
    { "formula": "hook formula", "example": "Hinglish example", "emotion": "Curiosity/Fear/Relatability/etc" }
  ],
  "contentIdeas": ["idea 1 specific to ${niche}", "idea 2", "idea 3"]
}`;

    const llmResult = await callLLM({ userId, endpoint: "trends", prompt, systemPrompt });
    const data = extractJSON(llmResult.text) || { raw: llmResult.text };

    return res.json({
      success: true,
      trends: data,
      _meta: { provider: llmResult.provider, model: llmResult.model }
    });
  } catch (err: any) {
    console.error("[/api/analyze/trends]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/analyze/pipeline ──────────────────────────────────────────────
router.post("/pipeline", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { platform, niche, language, profileUrl, competitors } = req.body;

  try {
    // Get real data for personalized pipeline
    let ownData: RealProfileData | null = null;
    if (profileUrl) {
      const { data } = await getRealProfileData(userId, platform, profileUrl);
      ownData = data;
    }

    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? "Tu expert content strategist hai. Personalized content pipeline bana based on REAL data. SIRF valid JSON return kar."
      : "You are an expert content strategist. Build personalized pipeline using REAL data. Return ONLY valid JSON.";

    const dataSection = ownData
      ? `USER'S REAL DATA:
- Username: @${ownData.username}
- Followers: ${ownData.followers.toLocaleString()}
- Current Engagement Rate: ${ownData.engagementRate}%
- Best performing content: ${ownData.posts.sort((a, b) => b.likes - a.likes).slice(0, 3).map(p => `"${(p.caption || "").substring(0, 60)}" (${p.likes} likes)`).join(", ")}
- Posting patterns: ${ownData.posts.map(p => new Date(p.timestamp).toLocaleDateString("en-IN", { weekday: "short" })).slice(0, 10).join(", ")}`
      : `Platform: ${platform}, Niche: ${niche}`;

    const prompt = `Create a personalized 30-day content pipeline:

${dataSection}
Known Competitors: ${Array.isArray(competitors) ? competitors.join(", ") : "None"}
Niche: ${niche || "General"}
Platform: ${platform}

Return JSON:
{
  "contentCalendar": [
    {
      "week": 1,
      "theme": "Week theme relevant to niche",
      "posts": [
        { "day": "Mon", "format": "Reel", "topic": "specific topic for ${niche}", "hook": "Hinglish hook line", "cta": "call to action" },
        { "day": "Wed", "format": "Carousel", "topic": "topic", "hook": "hook", "cta": "cta" },
        { "day": "Fri", "format": "Post", "topic": "topic", "hook": "hook", "cta": "cta" }
      ]
    },
    { "week": 2, "theme": "Week 2 theme", "posts": [] },
    { "week": 3, "theme": "Week 3 theme", "posts": [] },
    { "week": 4, "theme": "Week 4 theme", "posts": [] }
  ],
  "contentPillars": [
    { "pillar": "pillar name", "percentage": 40, "examples": ["ex1 for ${niche}", "ex2"] }
  ],
  "batchingStrategy": "how to batch-create for ${platform} efficiently",
  "repurposingPlan": [
    { "original": "${platform}", "repurpose": "other platform", "how": "brief steps" }
  ],
  "postingSchedule": {
    "frequency": "X posts/week",
    "bestDays": ["Mon", "Wed", "Fri"],
    "bestTimes": ["7-9 PM IST"],
    "reason": "why these times work for Indian audience"
  },
  "kpis": {
    "targetER": "${ownData ? (ownData.engagementRate * 1.5).toFixed(1) : "3.0"}%",
    "postingFrequency": "3/week",
    "growthTarget": "X followers/month"
  }
}`;

    const llmResult = await callLLM({ userId, endpoint: "pipeline", prompt, systemPrompt });
    const data = extractJSON(llmResult.text) || { raw: llmResult.text };

    return res.json({
      success: true,
      pipeline: data,
      _meta: { provider: llmResult.provider, model: llmResult.model }
    });
  } catch (err: any) {
    console.error("[/api/analyze/pipeline]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/analyze/save ───────────────────────────────────────────────────
// Save full analysis result
router.post("/save", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { profileUrl, platform, niche, auditData, competitorsData, trendsData, pipelineData } = req.body;

  try {
    const { data, error } = await supabase.from("analysis_results").insert({
      user_id: userId,
      profile_url: profileUrl,
      platform,
      niche: niche || null,
      result_type: "full",
      result_data: { audit: auditData, competitors: competitorsData, trends: trendsData, pipeline: pipelineData },
    }).select("id").single();

    if (error) throw new Error(error.message);
    return res.json({ success: true, analysisId: data.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
