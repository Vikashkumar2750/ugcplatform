import { Router, Request, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { callLLM } from "../services/llm";
import { runApifyActor, scrapeInstagramProfile } from "../services/scraper";

const router = Router();
router.use(requireAuth);

// Helper: extract JSON from LLM response
function extractJSON(text: string): unknown {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch {}
  }
  try {
    return JSON.parse(text.trim());
  } catch {}
  return null;
}

// ─── POST /api/analyze/audit ──────────────────────────────────────────────────
router.post("/audit", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { profileUrl, platform, niche, language } = req.body;

  if (!profileUrl) return res.status(400).json({ error: "profileUrl is required" });

  try {
    // Optional: scrape profile data via RapidAPI
    let scrapedData: unknown = {};
    try {
      if (platform === "instagram") {
        const username = profileUrl.replace(/.*instagram\.com\//i, "").replace(/\/$/, "").split("/")[0];
        const result = await scrapeInstagramProfile(username);
        scrapedData = result.posts.slice(0, 10);
      } else if (platform === "youtube") {
        // Extract channel ID from URL if possible; otherwise use Apify
        const items = await runApifyActor("streamers/youtube-channel-scraper", {
          startUrls: [{ url: profileUrl }],
          resultsLimit: 10,
        });
        scrapedData = items.slice(0, 5);
      }
    } catch (scrapeErr: any) {
      console.warn(`[audit] Scrape skipped: ${scrapeErr.message}`);
    }

    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? "Tu ek expert social media content strategist hai jo Indian creators ke liye kaam karta hai. Hinglish mein jawab de. JSON format mein jawab de."
      : "You are an expert social media content strategist for Indian creators. Respond in English. Respond in JSON format.";

    const prompt = `Analyze this ${platform} creator profile and give a comprehensive audit:

Profile URL: ${profileUrl}
Niche: ${niche || "Unknown"}
Scraped Data: ${JSON.stringify(scrapedData, null, 2).substring(0, 3000)}

Provide a JSON response with:
{
  "engagementRate": "X.X%",
  "benchmark": "brief context about whether ER is good/bad for this niche",
  "followerCount": "formatted number",
  "avgLikes": "formatted number",
  "avgComments": "formatted number",
  "postsAnalyzed": number,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3", "weakness 4"],
  "diagnosis": {
    "hookQuality": "assessment",
    "ctaPresence": "assessment",
    "consistency": "assessment",
    "contentVariety": "assessment",
    "hashtagStrategy": "assessment",
    "captionDepth": "assessment",
    "engagementLoop": "assessment"
  },
  "overallScore": number (0-100),
  "topRecommendation": "single most important action to take"
}`;

    const llmResult = await callLLM({ userId, endpoint: "audit", prompt, systemPrompt });
    const auditData = extractJSON(llmResult.text) || { raw: llmResult.text };

    return res.json({ success: true, audit: auditData });
  } catch (err: any) {
    console.error("[/api/analyze/audit]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/analyze/competitors ───────────────────────────────────────────
router.post("/competitors", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { platform, niche, language, competitors, profession } = req.body;

  try {
    let competitorData: unknown[] = [];

    if (competitors?.length) {
      try {
        if (platform === "instagram") {
          const usernames = competitors.map((url: string) =>
            url.replace(/.*instagram\.com\//i, "").replace(/\/$/, "").split("/")[0]
          );
          const results = await Promise.allSettled(
            usernames.slice(0, 3).map((u: string) => scrapeInstagramProfile(u))
          );
          competitorData = results
            .filter((r) => r.status === "fulfilled")
            .flatMap((r: any) => r.value.posts.slice(0, 5));
        } else if (platform === "youtube") {
          competitorData = await runApifyActor("streamers/youtube-channel-scraper", {
            startUrls: competitors.slice(0, 3).map((url: string) => ({ url })),
            resultsLimit: 5,
          });
        }
      } catch (scrapeErr: any) {
        console.warn(`[competitors] Scrape skipped: ${scrapeErr.message}`);
      }
    }

    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? "Tu expert social media analyst hai. Hinglish mein jawab de. JSON format mein."
      : "You are an expert social media analyst. Respond in English. JSON format.";

    const prompt = `Analyze competitors for this ${platform} creator and provide insights:
Niche: ${niche}
${profession ? `Creator's background: ${profession}` : ""}
Known Competitors: ${competitors?.join(", ") || "None provided — discover top 3"}
Scraped Data: ${JSON.stringify(competitorData.slice(0, 2), null, 2).substring(0, 2000)}

Provide JSON:
{
  "competitors": [
    {
      "handle": "@handle",
      "platform": "${platform}",
      "followers": "formatted",
      "engagementRate": "X.X%",
      "avgViews": "formatted",
      "whatTheyDoWell": ["point 1", "point 2", "point 3"],
      "hookStyle": "description",
      "postingFrequency": "X/week",
      "captionStyle": "description",
      "topHashtags": ["#tag1", "#tag2", "#tag3"]
    }
  ],
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "gapsToExploit": ["gap 1", "gap 2", "gap 3"],
  "recommendedNiche": "${niche || "suggested niche"}",
  "recommendedSubNiche": "more specific sub-niche"
}`;

    const llmResult = await callLLM({ userId, endpoint: "competitors", prompt, systemPrompt });
    const data = extractJSON(llmResult.text) || { raw: llmResult.text };

    return res.json({ success: true, competitors: data });
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
        // Instagram trending hashtag explore
        trendData = await runApifyActor("apify/instagram-scraper", {
          directUrls: [
            `https://www.instagram.com/explore/tags/${(niche || "India").toLowerCase().replace(/\s/g, "")}/`,
          ],
          resultsLimit: 15,
        });
      }
    } catch (scrapeErr: any) {
      console.warn(`[trends] Scrape skipped: ${scrapeErr.message}`);
    }

    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? "Tu Indian social media trend expert hai. Hinglish mein examples do. JSON format mein jawab."
      : "You are an Indian social media trend expert. JSON format.";

    const prompt = `Analyze trending content for ${platform} creators in India in the ${niche} niche (2025):

Trending Data: ${JSON.stringify(trendData.slice(0, 10), null, 2).substring(0, 2000)}

Provide JSON:
{
  "trendingFormats": [
    { "format": "format name", "growth": "+X%", "type": "Reel/Carousel/Short/Video", "whyItWorks": "brief explanation" }
  ],
  "trendingTopics": [
    { "topic": "topic name", "searchVolume": "High/Medium/Low", "competition": "High/Medium/Low" }
  ],
  "trendingHashtags": ["#tag1", "#tag2"],
  "trendingAudio": ["audio name 1", "audio name 2"],
  "seasonalOpportunity": "current month opportunity specific to Indian audience",
  "viralHookFormulas": [
    { "formula": "hook formula", "example": "Hindi/Hinglish example", "emotion": "Curiosity/Fear/Relatability/etc" }
  ]
}`;

    const llmResult = await callLLM({ userId, endpoint: "trends", prompt, systemPrompt });
    const data = extractJSON(llmResult.text) || { raw: llmResult.text };

    return res.json({ success: true, trends: data });
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
    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? "Tu expert content strategist hai. Actionable content pipeline bana. JSON format."
      : "You are an expert content strategist. Build an actionable content pipeline. JSON format.";

    const prompt = `Create a 30-day content pipeline for a ${platform} creator in the ${niche} niche:

Profile URL: ${profileUrl || "Not provided"}
Known Competitors: ${Array.isArray(competitors) ? competitors.join(", ") : "None"}

Provide JSON:
{
  "contentCalendar": [
    { "week": 1, "theme": "theme name", "posts": [{ "day": "Mon", "format": "Reel/Carousel", "topic": "topic", "hook": "hook line", "cta": "call to action" }] }
  ],
  "contentPillars": [{ "pillar": "pillar name", "percentage": 30, "examples": ["ex1", "ex2"] }],
  "batchingStrategy": "description of how to batch-create content",
  "repurposingPlan": [{ "original": "platform", "repurpose": "platform", "how": "brief steps" }],
  "kpis": { "targetER": "X%", "postingFrequency": "X/week", "growthTarget": "X followers/month" }
}`;

    const llmResult = await callLLM({ userId, endpoint: "pipeline", prompt, systemPrompt });
    const data = extractJSON(llmResult.text) || { raw: llmResult.text };

    return res.json({ success: true, pipeline: data });
  } catch (err: any) {
    console.error("[/api/analyze/pipeline]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
