import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { callLLM } from "../services/llm";
import { executeMetaBatch, MetaBatchRequest } from "../lib/meta-batch";

const router = Router();
router.use(requireAuth);

// Helper: extract JSON from LLM response
function extractJSON(text: string): any {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch {}
  }
  try { return JSON.parse(text.trim()); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const slice = text.slice(start, end + 1);
    try { return JSON.parse(slice); } catch {}
    try { return JSON.parse(slice.replace(/,\s*([}\]])/g, "$1")); } catch {}
  }
  return null;
}

// (Fabricated rule-based insights generator removed in compliance with strict actual-data guidelines)

// GET /api/insights/:platform/:accountId/overview
// Fetches time-series data for Reach, Impressions, Profile Views
router.get("/:platform/:accountId/overview", async (req: Request, res: Response) => {
  const { platform, accountId } = req.params;
  const { userId } = req as AuthenticatedRequest;
  const { days = "28" } = req.query;

  if (platform !== "instagram" && platform !== "facebook") {
    return res.status(400).json({ error: "Unsupported platform" });
  }

  const { data: account, error: accountError } = await supabase
    .from("connected_accounts")
    .select("access_token")
    .eq("platform_user_id", accountId)
    .eq("user_id", userId)
    .single();

  if (accountError || !account) {
    return res.status(404).json({ error: "Connected account not found" });
  }

  const daysInt = parseInt(days as string, 10) || 28;
  const since = Math.floor((Date.now() - daysInt * 24 * 60 * 60 * 1000) / 1000);
  const until = Math.floor(Date.now() / 1000);

  // Impressions, Reach, Profile Views
  let metrics = "impressions,reach,profile_views";
  if (platform === "facebook") {
    metrics = "page_impressions_unique,page_impressions,page_views_total";
  }

  const apiUrl =
    `https://graph.facebook.com/v21.0/${accountId}/insights` +
    `?metric=${metrics}` +
    `&period=day` +
    `&since=${since}&until=${until}` +
    `&access_token=${account.access_token}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/insights/:platform/:accountId/audience
// Fetches demographic data (Age, Gender, City, Country)
router.get("/:platform/:accountId/audience", async (req: Request, res: Response) => {
  const { platform, accountId } = req.params;
  const { userId } = req as AuthenticatedRequest;

  if (platform !== "instagram" && platform !== "facebook") {
    return res.status(400).json({ error: "Unsupported platform" });
  }

  const { data: account, error: accountError } = await supabase
    .from("connected_accounts")
    .select("access_token")
    .eq("platform_user_id", accountId)
    .eq("user_id", userId)
    .single();

  if (accountError || !account) {
    return res.status(404).json({ error: "Connected account not found" });
  }

  let metrics = "audience_gender_age,audience_country,audience_city";
  if (platform === "facebook") {
    metrics = "page_fans_gender_age,page_fans_country,page_fans_city";
  }

  const apiUrl =
    `https://graph.facebook.com/v21.0/${accountId}/insights` +
    `?metric=${metrics}` +
    `&period=lifetime` +
    `&access_token=${account.access_token}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/insights/:platform/:accountId/media
// Fetches recent media items and their insights using batch API
router.get("/:platform/:accountId/media", async (req: Request, res: Response) => {
  const { platform, accountId } = req.params;
  const { userId } = req as AuthenticatedRequest;
  const { limit = "30" } = req.query;

  if (platform !== "instagram") {
    return res.status(400).json({ error: "Unsupported platform for media insights" });
  }

  const { data: account, error: accountError } = await supabase
    .from("connected_accounts")
    .select("access_token")
    .eq("platform_user_id", accountId)
    .eq("user_id", userId)
    .single();

  if (accountError || !account) {
    return res.status(404).json({ error: "Connected account not found" });
  }

  try {
    const mediaUrl = `https://graph.facebook.com/v21.0/${accountId}/media?fields=id,timestamp,media_type,media_url,thumbnail_url,caption,like_count,comments_count,permalink&limit=${limit}&access_token=${account.access_token}`;
    const mediaRes = await fetch(mediaUrl);
    const mediaData = await mediaRes.json();

    if (mediaData.error) {
      return res.status(400).json({ error: mediaData.error.message });
    }

    const posts = mediaData.data || [];
    if (posts.length === 0) {
      return res.json({ data: [] });
    }

    const batchRequests: MetaBatchRequest[] = posts.map((post: any) => ({
      method: "GET",
      relative_url: `${post.id}/insights?metric=reach,saved,impressions,shares`
    }));

    const batchResults = await executeMetaBatch(account.access_token, batchRequests);

    const enrichedPosts = posts.map((post: any, index: number) => {
      const result = batchResults[index];
      let reach = 0, saved = 0, impressions = 0, shares = 0;
      
      if (result.code === 200) {
        const body = JSON.parse(result.body);
        if (body.data) {
          const findMetric = (name: string) => body.data.find((m: any) => m.name === name)?.values?.[0]?.value || 0;
          reach = findMetric("reach");
          saved = findMetric("saved");
          impressions = findMetric("impressions");
          shares = findMetric("shares");
        }
      }
      
      return {
        ...post,
        insights: { reach, saved, impressions, shares }
      };
    });

    return res.json({ data: enrichedPosts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/insights/:platform/:accountId
router.get("/:platform/:accountId", async (req: Request, res: Response) => {
  const { platform, accountId } = req.params;
  const { userId } = req as AuthenticatedRequest;
  const { metric, period } = req.query;

  if (platform !== "instagram" && platform !== "facebook") {
    return res.status(400).json({ error: "Unsupported platform" });
  }

  const { data: account, error: accountError } = await supabase
    .from("connected_accounts")
    .select("access_token")
    .eq("platform_user_id", accountId)
    .eq("user_id", userId)
    .single();

  if (accountError || !account) {
    return res.status(404).json({ error: "Connected account not found" });
  }

  const fields = metric || "impressions,reach,profile_views,follower_count";
  const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const until = Math.floor(Date.now() / 1000);

  const apiUrl =
    `https://graph.facebook.com/v21.0/${accountId}/insights` +
    `?metric=${fields}` +
    `&period=${period || "day"}` +
    `&since=${since}&until=${until}` +
    `&access_token=${account.access_token}`;

  const igRes = await fetch(apiUrl);
  const data = await igRes.json();

  if (data.error) {
    return res.status(400).json({ error: data.error.message });
  }

  return res.json(data);
});

// POST /api/insights/generate-ai
router.post("/generate-ai", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { platform, handle, name, statsData } = req.body;

  if (!platform || !statsData) {
    return res.status(400).json({ error: "platform and statsData are required" });
  }

  try {
    const sysPrompt = `You are a world-class social media strategist and data analyst.
Analyze the following ${platform} insights data for a creator. 
Crucially, pay attention to the TYPE of content (e.g. Video/Reel vs Carousel vs Static Image on Instagram, or Shorts vs Long-form on YouTube).
Tailor your hook and body analysis strictly to the specific format of each top-performing post.

Account Information:.
You must strictly follow the JSON schema provided. Do not return any markdown code fences, backticks, or text before/after the JSON.
Do not use placeholder text like "[Your Name]" or "[CTA]". Use actual concrete examples matching their niche or standard templates.
All text must be engaging, brief, and highly practical. Make the suggested actions extremely tactical and ready to copy.`;

    const userPrompt = `Analyze this ${platform} account data:
- Name: ${name || "N/A"} (Handle: ${handle || "N/A"})
- Followers/Subscribers: ${statsData.followers || 0}
- Media Count: ${statsData.mediaCount || 0}
- Engagement Rate: ${statsData.engagementRate || 0}%
- Average Likes: ${statsData.avgLikes || 0}
- Average Comments: ${statsData.avgComments || 0}
- Average Saves: ${statsData.avgSaves || 0}
- Average Reach: ${statsData.avgReach || 0}
- Profile Visits (30d): ${statsData.profileVisits || 0}
- Website Clicks (30d): ${statsData.websiteClicks || 0}
- Recent Posts analyzed: ${statsData.postsAnalyzed || 0} (published in 30d: ${statsData.posts30dCount || 0}, in 7d: ${statsData.posts7dCount || 0})

Week-over-Week Comparison (7d vs prev 7d):
- Reach: ${statsData.comparison7d?.reach?.current || 0} vs ${statsData.comparison7d?.reach?.previous || 0} (${statsData.comparison7d?.reach?.pct || 0}%)
- Impressions: ${statsData.comparison7d?.impressions?.current || 0} vs ${statsData.comparison7d?.impressions?.previous || 0} (${statsData.comparison7d?.impressions?.pct || 0}%)
- Engagement Rate: ${statsData.comparison7d?.er?.current || 0}% vs ${statsData.comparison7d?.er?.previous || 0}% (${statsData.comparison7d?.er?.pct || 0}%)
- Posts Published: ${statsData.comparison7d?.posts?.current || 0} vs ${statsData.comparison7d?.posts?.previous || 0}

Top Performing Posts:
${(statsData.topPosts || []).map((p: any) => `* ID: ${p.postId || p.id} | Type: ${p.type} | ER: ${p.er}% | Likes: ${p.likes} | Comments: ${p.comments} | Saves: ${p.saves} | Reach: ${p.reach} | Caption snippet: "${p.caption || ''}"`).join("\n")}

Format the response strictly as a single JSON object with these keys:
{
  "executiveSummary": "A concise paragraph answering: What happened, why it happened, and what to do next. Use active language.",
  "topPostsAnalysis": [
    { 
      "postId": "string", 
      "hookAnalysis": "Specific breakdown of why the hook worked or failed (considering if it's a Reel, Carousel, Short, or Image)",
      "bodyAnalysis": "Specific breakdown of why the body retained attention or failed, keeping the content format in mind",
      "ctaAnalysis": "Specific breakdown of the Call-To-Action used, and a better alternative CTA example"
    }
  ],
  "underperformingPostsAnalysis": [
    { "postId": "string", "reason": "Specific reasons why this post did not hit reach targets", "suggestion": "Actionable visual or copywriting tweak to fix it" }
  ],
  "bestPostingTime": {
    "days": ["string"],
    "hours": ["string"],
    "confidenceScore": 1-100
  },
  "profileHealth": {
    "bioOptimization": "Specific suggestion for writing a better, benefit-driven bio",
    "ctaQuality": "Specific advice on optimizing their link-in-bio call-to-action",
    "completeness": "e.g. 90%",
    "seoOptimization": "Suggest keywords to insert in display name and bio search terms"
  },
  "recommendations": [
    {
      "title": "Short title",
      "expectedImpact": "High" | "Medium" | "Low",
      "priority": "High" | "Medium" | "Low",
      "reasoning": "Data-backed reasoning based on their stats",
      "suggestedAction": "Extremely tactical template or action step they can execute today"
    }
  ]
}`;

    // Invoke LLM
    const response = await callLLM({
      userId,
      endpoint: "insights",
      prompt: userPrompt,
      systemPrompt: sysPrompt
    });

    const parsedJson = extractJSON(response.text);
    if (!parsedJson || typeof parsedJson !== "object") {
      throw new Error("LLM failed to output valid JSON configuration");
    }

    return res.json({ aiData: parsedJson });

  } catch (err: any) {
    // Silent failover to empty object
    return res.json({ aiData: {}, _fallback: true, error: err.message });
  }
});

export default router;
