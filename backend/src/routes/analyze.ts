import { Router, Request, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { callLLM } from "../services/llm";
import { scrapeInstagramProfile, scrapeCompetitorFull, EnhancedCompetitorData, runApifyActor } from "../services/scraper";
import {
  fetchConnectedInstagramData,
  fetchConnectedFacebookData,
  RealProfileData,
} from "../services/meta-data";
import { supabase } from "../lib/supabase";
import { decrypt } from "../services/crypto";
import { aggregateIntelligence, IntelligencePost } from "../services/intelligence";

const router = Router();
router.use(requireAuth);

// Global memory cache for tracking pipeline progress
export const pipelineProgressMap = new Map<string, number>();

// ─── GET /api/analyze/pipeline-progress ───────────────────────────────────────
router.get("/pipeline-progress", (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const profileUrl = req.query.profileUrl as string;
  const key = `${userId}-${profileUrl}`;
  const progress = pipelineProgressMap.get(key) || 0;
  res.json({ progress });
});

// ─── Helper: extract JSON from LLM response (multi-pass) ────────────────────
function extractJSON(text: string): unknown {
  if (!text) return null;
  // Pass 1: code fence (```json ... ``` or ``` ... ```)
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch {}
  }
  // Pass 2: raw JSON parse
  try { return JSON.parse(text.trim()); } catch {}
  // Pass 3: first `{` to last `}` greedy extraction
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const slice = text.slice(start, end + 1);
    try { return JSON.parse(slice); } catch {}
    // Pass 4: try removing trailing commas (common LLM quirk)
    try { return JSON.parse(slice.replace(/,\s*([}\]])/g, "$1")); } catch {}
  }
  console.warn("[extractJSON] All passes failed. First 300 chars:", text.substring(0, 300));
  return null;
}

// ─── Helper: validate LLM output — reject obvious placeholder responses ───────
function validateLLMOutput(data: any, endpoint: string): { valid: boolean; warnings: string[] } {
  if (!data || typeof data !== "object") return { valid: false, warnings: ["Empty or non-object response"] };
  const PLACEHOLDER_PATTERNS = [
    /WRITE (ACTUAL|REAL)/i,
    /\[TOPIC\]/i,
    /your topic here/i,
    /specific insight \d/i,
    /idea \d+$/i,
  ];
  const text = JSON.stringify(data);
  const warnings: string[] = [];
  for (const p of PLACEHOLDER_PATTERNS) {
    if (p.test(text)) {
      warnings.push(`Placeholder text detected: ${p.source}`);
      break;
    }
  }
  // Check field lengths for key endpoints
  if (endpoint === "audit" && typeof data.topRecommendation === "string" && data.topRecommendation.length < 20) {
    warnings.push("topRecommendation is too short — likely generic");
  }
  if (endpoint === "competitors" && Array.isArray(data.competitors) && data.competitors.length === 0) {
    warnings.push("No competitors returned");
  }
  return { valid: warnings.length === 0, warnings };
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
  if (platform === "linkedin") {
    const match = url.match(/linkedin\.com\/(?:in|company)\/([^/?\s]+)/i);
    return match ? match[1] : url.replace(/.*linkedin\.com\//i, "").replace(/\/$/, "").split("/").filter(Boolean).pop() || "";
  }
  return "";
}

async function getUserScraperKeys(userId: string): Promise<{ rapidapi?: string, apify?: string }> {
  const { data: keyRows } = await supabase
    .from("user_api_keys")
    .select("provider, encrypted_key")
    .eq("user_id", userId)
    .in("provider", ["rapidapi", "apify"])
    .eq("is_active", true);

  const userKeys: { rapidapi?: string, apify?: string } = {};
  for (const row of keyRows || []) {
    try { 
      if (row.provider === "rapidapi") userKeys.rapidapi = decrypt(row.encrypted_key);
      if (row.provider === "apify") userKeys.apify = decrypt(row.encrypted_key);
    } catch {}
  }
  return userKeys;
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

  // 2. Fetch user's scraper API keys from DB
  const userKeys = await getUserScraperKeys(userId);

  // 3. Fallback: Scraper
  try {
    if (platform === "instagram" && username) {
      const result = await scrapeInstagramProfile(username, userKeys);
      if (result.posts.length > 0) {
        const posts = result.posts.slice(0, 20);
        const avgLikes = Math.round(posts.reduce((s, p) => s + (p.likes || 0), 0) / posts.length);
        const avgComments = Math.round(posts.reduce((s, p) => s + (p.comments || 0), 0) / posts.length);
        const followers = result.profile?.followers || 0;
        // BUG-FIX: ER was hardcoded to 0 — now computed correctly
        // Cap at 50% — micro-accounts with tiny follower counts can produce unrealistic values
        const rawER = followers > 0
          ? parseFloat(((avgLikes + avgComments) / followers * 100).toFixed(2))
          : 0;
        const engagementRate = Math.min(rawER, 50);
        return {
          data: {
            username,
            followers,
            following: result.profile?.following || 0,
            mediaCount: result.profile?.posts || posts.length,
            biography: result.profile?.bio,
            avgLikes,
            avgComments,
            engagementRate,
            posts: posts.map(p => ({
              id: p.id,
              caption: p.caption,
              likes: p.likes || 0,
              comments: p.comments || 0,
              mediaType: (p.type === "VIDEO" || (p.views || 0) > 0) ? "VIDEO" : "IMAGE",
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

// ─── CACHE HELPER ─────────────────────────────────────────────────────────────
async function getCachedAnalysis(userId: string, platform: string, profileUrl: string, type: "audit" | "competitors" | "trends" | "pipeline") {
  const { data } = await supabase
    .from("analysis_results")
    .select("result, created_at")
    .eq("user_id", userId)
    .eq("platform", platform)
    .filter("result->>profileUrl", "eq", profileUrl)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!data) return null;
  
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  for (const row of data) {
    if (new Date(row.created_at) < sevenDaysAgo) continue;
    if (row.result) {
       if (type === "audit" && row.result.audit) return row.result.audit;
       if (type === "competitors" && row.result.competitors) return row.result.competitors;
       if (type === "trends" && row.result.trends) return row.result.trends;
       if (type === "pipeline" && row.result.pipeline) return row.result.pipeline;
    }
  }
  return null;
}

// ─── POST /api/analyze/audit ──────────────────────────────────────────────────
router.post("/audit", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { profileUrl, platform, niche, language } = req.body;

  if (!profileUrl) return res.status(400).json({ error: "profileUrl is required" });

  try {
    if (!req.body.forceFresh) {
      const cached = await getCachedAnalysis(userId, platform, profileUrl, "audit");
      if (cached) {
        console.log(`[audit] Using 7-day cache for ${profileUrl}`);
        return res.json({
          success: true,
          audit: cached,
          dataSource: "cache",
          _meta: { provider: "cache", model: "cache", dataSource: "cache" }
        });
      }
    }

    const { data: realData, source } = await getRealProfileData(userId, platform, profileUrl);
    console.log(`[audit] Data source: ${source}, posts: ${realData?.posts?.length || 0}`);

    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? "Tu ek elite social media growth hacker aur content strategist hai jo Indian creators aur brands ke liye viral strategies banata hai. Tere suggestions extremely deep, actionable aur highly relevant hone chahiye. Hinglish ka natural use kar. Koi generic gyan nahi. SIRF valid JSON return kar — koi extra text mat likho."
      : "You are an elite social media growth hacker and content strategist for Indian creators. Your analysis must be highly specific, culturally relevant, actionable, and based on modern algorithms (watch-time, saves, shares). Return ONLY valid JSON — no extra text.";

    let intelligenceSummary = "";
    if (realData && realData.posts && realData.posts.length > 0) {
      const intelPosts: IntelligencePost[] = realData.posts.map((p: any) => ({
        id: p.id,
        caption: p.caption,
        likes: p.likes || 0,
        comments: p.comments || 0,
        views: p.views || p.reach || p.likes * 10 || 0,
        timestamp: p.timestamp,
        type: p.mediaType,
      }));
      const intel = aggregateIntelligence(intelPosts);
      intelligenceSummary = `
ADVANCED INTELLIGENCE DATA:
- Dominant Hook Types: ${intel.trend_intelligence.dominant_hook_types.map(h => `${h.type}(${h.count})`).join(", ")}
- Content Categories: ${intel.trend_intelligence.dominant_content_categories.map(c => `${c.category}(${c.count})`).join(", ")}
- Top Hooks (Viral):
${intel.top_hooks.slice(0, 3).map(h => `  * "${h.hook}" (Viral Score: ${h.viral_score})`).join("\n")}
`;
    }

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
${intelligenceSummary}
RECENT POSTS (last ${realData.posts.length} posts):
${realData.posts.slice(0, 10).map((p: any, i: number) =>
  `Post ${i + 1}: ${p.mediaType} | Likes: ${p.likes} | Comments: ${p.comments}${p.saves ? ` | Saves: ${p.saves}` : ""}${p.reach ? ` | Reach: ${p.reach}` : ""} | Caption: "${(p.caption || "").substring(0, 100)}"`
).join("\n")}`
      : `Profile URL: ${profileUrl}\n(No direct data available — analyze based on URL and niche)`;

    const prompt = `Perform a highly critical, non-generic audit of this ${platform} creator. Do NOT use generic advice like "post consistently" or "use good hashtags". Be brutal, specific, and actionable. Look at the actual data and captions.

${dataSection}
Niche: ${niche || "Not specified"}
Data Source: ${source}

Return JSON:
{
  "engagementRate": "${realData?.engagementRate || 0}%",
  "benchmark": "Is this ER actually good for the current algorithm in the ${niche} niche? Be honest.",
  "followerCount": "${realData?.followers?.toLocaleString() || "Unknown"}",
  "followingCount": "${realData?.following?.toLocaleString() || "Unknown"}",
  "mediaCount": "${realData?.mediaCount?.toLocaleString() || "Unknown"}",
  "avgLikes": "${realData?.avgLikes || "Unknown"}",
  "avgComments": "${realData?.avgComments || "Unknown"}",
  "postsAnalyzed": ${realData?.posts?.length || 0},
  "dataSource": "${source}",
  "strengths": ["Hyper-specific strength 1 based on actual hooks/data", "Specific strength 2", "Specific strength 3"],
  "weaknesses": ["Crucial weakness 1 (e.g. boring hooks, bad visual pacing)", "Weakness 2", "Weakness 3"],
  "diagnosis": {
    "hookQuality": "Analyze the 3-second hook retention based on their captions and media types. Be critical.",
    "ctaPresence": "Are they actually driving profile visits/saves? Analyze their Call to Actions.",
    "consistency": "Are they posting enough for the 2026 algorithm?",
    "contentVariety": "Are they relying too much on one format?",
    "hashtagStrategy": "Critique their hashtag usage.",
    "captionDepth": "Are the captions actually retaining read-time? Or are they generic?",
    "engagementLoop": "Are they fostering community or just broadcasting?"
  },
  "weak_content_areas": ["Detailed area 1 where they lose attention", "Detailed area 2"],
  "cta_insights": ["Specific psychological CTA that would work better for their audience", "Another CTA insight"],
  "content_gaps": ["Highly specific topic gap in their niche they aren't covering", "Another gap"],
  "viral_hook_suggestions": ["Exact script for Hook 1 (Hinglish/English depending on language)", "Exact script for Hook 2", "Exact script for Hook 3"],
  "overallScore": 75,
  "topRecommendation": "The single most brutal, actionable change they need to make right now.",
  "profileMakeover": {
    "before": {
      "name": "Current generic or bad name example (e.g., Karan)",
      "bio": "Their current bio or a generic bad bio example (e.g., Foodie 🍔 | Dreamer ✨ | Traveller ✈️\\nLiving my best life ❤️)",
      "flaws": ["Generic", "No Value", "No Reason To Follow"]
    },
    "after": {
      "name": "Optimized Name | Niche (e.g., Aditya | Instagram Growth Coach)",
      "bio": "Optimized Bio line 1\\nOptimized Bio line 2\\nOptimized Bio line 3",
      "benefits": ["Clear", "Valuable", "Follow-Worthy"]
    }
  }
}`;

    const llmResult = await callLLM({ userId, endpoint: "audit", prompt, systemPrompt });
    const auditData = extractJSON(llmResult.text) || { raw: llmResult.text };

    // Save to analysis_results table — actual columns: id, user_id, platform, result, created_at
    const { data: saved } = await supabase.from("analysis_results").insert({
      user_id: userId,
      platform,
      result: {
        type: "audit",
        profileUrl,
        niche: niche || null,
        dataSource: source,
        audit: auditData,
      },
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
    if (!req.body.forceFresh) {
      const cached = await getCachedAnalysis(userId, platform, profileUrl, "competitors");
      if (cached) {
        console.log(`[competitors] Using 7-day cache for ${profileUrl}`);
        return res.json({
          success: true,
          competitors: cached,
          dataSource: "cache",
          _meta: { provider: "cache", model: "cache", dataSource: "cache" }
        });
      }
    }

    // Get user's own real data first (for comparison baseline)
    let ownData: RealProfileData | null = null;
    if (profileUrl) {
      const { data } = await getRealProfileData(userId, platform, profileUrl);
      ownData = data;
    }

    // ── ENHANCED: Scrape EACH competitor using BOTH Apify actors ─────────────
    let enhancedCompetitors: EnhancedCompetitorData[] = req.body.rawCompetitorsData || [];
    let targetCompetitors = competitors || [];

    if (targetCompetitors.length === 0 && platform === "instagram") {
      const searchNiche = niche || profession || "Digital Creator";
      console.log(`[competitors] Discover mode. Finding top creators for niche: ${searchNiche}`);
      const discoveryPrompt = `You are a social media research assistant.
Find exactly 3 real, popular, and highly active Instagram creators in India in the niche: "${searchNiche}"${profession ? ` (Profession: ${profession})` : ""}.
Your response must be a JSON array of their exact username handles, without the '@' character and in lowercase.
Example: ["sharanhegde", "financewithsharan", "warikoo"]
Return ONLY this JSON array. No markdown, no comments, no extra text.`;

      try {
        const discoverRes = await callLLM({
          userId,
          endpoint: "discover_competitors",
          prompt: discoveryPrompt,
          systemPrompt: "You are a precise data retriever. Return ONLY JSON array of strings."
        });
        const discovered = extractJSON(discoverRes.text);
        if (Array.isArray(discovered)) {
          targetCompetitors = discovered.map(username => `https://instagram.com/${username.trim().replace(/^@/, "")}`);
          console.log(`[competitors] Discovered competitors: ${targetCompetitors.join(", ")}`);
        }
      } catch (err: any) {
        console.warn(`[competitors] Failed to discover competitors: ${err.message}`);
      }
    }

    if (enhancedCompetitors.length === 0 && targetCompetitors?.length && platform === "instagram") {
      const usernames = targetCompetitors
        .map((url: string) => extractUsername(url, "instagram"))
        .filter(Boolean)
        .slice(0, 3);

      console.log(`[competitors] Starting enhanced Apify scrape for: ${usernames.join(", ")}`);

      const userKeys = await getUserScraperKeys(userId);
      const results = await Promise.allSettled(
        usernames.map((u: string) => scrapeCompetitorFull(u, userKeys))
      );

      enhancedCompetitors = results
        .filter(r => r.status === "fulfilled")
        .map((r: any) => r.value);

      console.log(`[competitors] Enhanced scrape complete: ${enhancedCompetitors.length} competitors, total posts: ${enhancedCompetitors.reduce((s, c) => s + c.allPosts.length, 0)}`);
    }

    const isHindi = language === "hi";

    const systemPrompt = isHindi
      ? `Tu ek elite AI Content Intelligence Engine hai jo expert hai:
- performance marketing
- creator economy growth
- social media psychology  
- viral content analysis
- Instagram growth strategy
- trend forecasting

SIRF real scraped data use karo — koi hallucination nahi. Ekdam brutal aur deep insights de, generic "post daily" wali baatein nahi. Hinglish ka natural use kar. SIRF valid JSON return karo.`
      : `You are an elite AI Content Intelligence Engine trained in:
- Performance marketing & creator economy
- Social media psychology & viral content analysis
- Instagram growth strategy & trend forecasting
- Audience retention & engagement optimization

RULES: Use ONLY real scraped data. Never hallucinate metrics. Provide deeply analytical, non-generic insights. Return ONLY valid JSON.`;

    const ownSection = ownData
      ? `USER's OWN ACCOUNT (@${ownData.username}):
- Followers: ${ownData.followers.toLocaleString()} | Following: ${ownData.following}
- Avg Likes: ${ownData.avgLikes} | Avg Comments: ${ownData.avgComments}
- Engagement Rate: ${ownData.engagementRate}%
- Bio: "${ownData.biography || "Not set"}"
- Total Posts: ${ownData.mediaCount}`
      : `User Platform: ${platform} | Niche: ${niche || "to be detected"}`;

    // Build rich competitor data section
    const buildCompetitorSection = (c: EnhancedCompetitorData, i: number) => {
      const allPosts = c.allPosts || [];
      const intel = aggregateIntelligence(allPosts.map((p: any) => ({
        id: p.id, caption: p.caption || "", likes: p.likes || 0, comments: p.comments || 0, views: p.views || 0, timestamp: p.timestamp, type: p.type
      })));
      return `
═══════════════════════════════════════
COMPETITOR ${i + 1}: @${c.username}
═══════════════════════════════════════
PROFILE:
- Full Name: ${c.profile.fullName}
- Followers: ${c.profile.followers.toLocaleString()} | Following: ${c.profile.following}
- Total Posts: ${c.profile.postsCount}
- Verified: ${c.profile.verified}
- Bio: "${c.profile.bio}"

ENGAGEMENT STATS (${c.engagementStats.totalPostsAnalyzed} posts):
- Avg Likes: ${c.engagementStats.avgLikes.toLocaleString()}
- Avg Comments: ${c.engagementStats.avgComments.toLocaleString()}
- Avg Views: ${c.engagementStats.avgViews.toLocaleString()}
- Engagement Rate: ${c.engagementStats.engagementRate}%
- Top Post Views: ${c.engagementStats.topPostViews.toLocaleString()}

ADVANCED INTELLIGENCE DATA:
- Dominant Hook Types: ${intel.trend_intelligence.dominant_hook_types.map((h: any) => `${h.type}(${h.count})`).join(", ")}
- Content Categories: ${intel.trend_intelligence.dominant_content_categories.map((cat: any) => `${cat.category}(${cat.count})`).join(", ")}
- Top Hashtags: ${intel.trend_intelligence.top_hashtags.map((t: any) => t.tag).join(", ")}
- CTA Patterns: ${intel.trend_intelligence.cta_patterns.slice(0, 2).map((cta: any) => `"${cta.hook}"`).join(", ")}

TOP 5 VIRAL POSTS (by views):
${c.topPosts.slice(0, 5).map((p: any, pi: number) => `  #${pi + 1} [${p.type}] Views:${p.views.toLocaleString()} Likes:${p.likes.toLocaleString()}
   Hook: "${p.hookText.substring(0, 80)}"
   Tags: ${p.hashtags.slice(0, 6).join(" ")} | CTA:${p.hasCTA}`).join("\n")}
`;
    };

    const competitorDataSection = enhancedCompetitors.length > 0
      ? enhancedCompetitors.map((c, i) => buildCompetitorSection(c, i)).join("\n")
      : `Competitor URLs: ${competitors?.join(", ") || "None provided"}\n(No scraped data available — analyze based on URL and niche knowledge)`;

    const nicheSection = niche
      ? `Confirmed Niche: ${niche}`
      : `NICHE NOT SPECIFIED — Auto-detect from competitor bios and content above`;

    const prompt = `You are an elite AI Content Intelligence Engine. Perform COMPLETE 20-layer analysis.

${ownSection}

${competitorDataSection}

${nicheSection}

═══════════════════════════════════════
PERFORM ALL 20 ANALYSIS TASKS:
═══════════════════════════════════════
1. Niche Detection (from bios + content)
2. Creator Archetype Detection (educator/entertainer/authority/storyteller)
3. Audience Intent Mapping (what do followers want from this creator)
4. Hook Pattern Analysis (what opening lines get most views)
5. Emotional Trigger Analysis (fear/aspiration/curiosity/social proof)
6. Viral Structure Detection (what content structure appears in top posts)
7. Content Pillar Classification (main categories of content)
8. Posting Frequency Analysis (from post count and timing patterns)
9. Engagement Pattern Analysis (which post types get best ER)
10. CTA Analysis (what calls-to-action are used)
11. Audience Pain Point Extraction (from captions + engagement patterns)
12. Trend Opportunity Detection (topics gaining traction)
13. Content Gap Analysis (what's missing that would work)
14. Reel Framework Extraction (structure used in top video content)
15. Retention Strategy Detection (how they keep watchers engaged)
16. Thumbnail/Cover Pattern Analysis (visual style from post types)
17. Comment Sentiment Analysis (based on caption tone + CTA types)
18. Content Saturation Detection (oversaturated vs fresh angles)
19. Virality Probability Scoring (which content type is most likely to go viral)
20. Follower Conversion Analysis (what drives people to follow)

ALSO ANALYZE:
- Competitor BIOS: Identify what makes their bio effective — keywords, CTA, positioning statement
- Profile Optimization: Based on competitor bios, suggest EXACT improved bio for the user's account

Return ONLY this JSON structure:
{
  "detectedNiche": "specific niche detected",
  "audienceIntelligence": {
    "primaryAudience": "who follows these creators (age, interest, intent)",
    "audienceIntent": "what they're looking for (learn/entertain/inspire/buy)",
    "painPoints": ["pain point 1", "pain point 2", "pain point 3", "pain point 4"],
    "desiredOutcomes": ["what audience wants to achieve 1", "what audience wants 2"],
    "confidence": "High/Medium/Low",
    "evidence": "evidence summary from post captions and engagement"
  },
  "competitors": [
    {
      "username": "@handle",
      "realFollowers": "exact number",
      "engagementRate": "X.XX%",
      "postingFrequency": "X posts/week (estimated)",
      "creatorArchetype": "Educator / Entertainer / Authority / Storyteller",
      "bio": "their actual bio text",
      "bioStrengths": ["what works in their bio", "keyword strategy", "CTA effectiveness"],
      "hookStyle": "pattern in their top posts (question/statement/number/shock)",
      "emotionalTriggers": ["curiosity", "fear of missing out", "aspiration"],
      "contentPillars": ["pillar 1 - X%", "pillar 2 - X%", "pillar 3 - X%"],
      "viralStructure": "describe the repeatable structure in their top posts",
      "topHashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
      "viralTopics": ["topic 1 with views", "topic 2", "topic 3"],
      "viralHook": "exact hook pattern from most viral post",
      "avgViralViews": "average views of top 3 posts",
      "ctaStrategy": "what CTAs they use most",
      "retentionStrategy": "how they retain attention",
      "viralityScore": 85,
      "viralityReason": "why this content type goes viral",
      "weaknesses": ["weakness 1", "weakness 2"]
    }
  ],
  "bioOptimization": {
    "userCurrentBio": "${ownData?.biography || "Not connected"}",
    "competitorBioInsights": [
      "what works in competitor bios",
      "keywords that attract followers",
      "CTA patterns used"
    ],
    "suggestedBio": "Write an EXACT improved bio for the user — max 150 chars, includes value proposition, niche keywords, and CTA. Make it platform-native.",
    "bioImprovements": [
      "specific change 1 and why",
      "specific change 2 and why",
      "specific change 3 and why"
    ],
    "keywordsToAdd": ["keyword1", "keyword2", "keyword3"],
    "cta": "Suggested CTA line for bio"
  },
  "viralContentBlueprint": {
    "topPerformingFormat": "Reel/Carousel/Post",
    "topPerformingTopic": "most viral topic category",
    "topPerformingHook": "the hook structure that gets most views",
    "optimalLength": "30-60s for reels / 7 slides for carousels",
    "postingTime": "best time based on audience",
    "editingStyle": "fast cuts/talking head/B-roll heavy",
    "viralityProbability": 82,
    "confidence": "High",
    "evidence": "based on analysis of X posts"
  },
  "hookFormulas": [
    {
      "formula": "exact hook structure",
      "example": "real example from top post",
      "emotionalTrigger": "curiosity/fear/aspiration",
      "avgViews": "estimated avg views when used",
      "confidence": "High/Medium"
    },
    { "formula": "hook 2", "example": "...", "emotionalTrigger": "...", "avgViews": "...", "confidence": "High" },
    { "formula": "hook 3", "example": "...", "emotionalTrigger": "...", "avgViews": "...", "confidence": "High" },
    { "formula": "hook 4", "example": "...", "emotionalTrigger": "...", "avgViews": "...", "confidence": "High" },
    { "formula": "hook 5", "example": "...", "emotionalTrigger": "...", "avgViews": "...", "confidence": "High" }
  ],
  "viralContentIdeas": [
    { "title": "Idea 1", "hook": "Suggested hook", "whyItWorks": "Why this works for this audience" },
    { "title": "Idea 2", "hook": "Suggested hook", "whyItWorks": "Why this works for this audience" },
    { "title": "Idea 3", "hook": "Suggested hook", "whyItWorks": "Why this works for this audience" },
    { "title": "Idea 4", "hook": "Suggested hook", "whyItWorks": "Why this works for this audience" },
    { "title": "Idea 5", "hook": "Suggested hook", "whyItWorks": "Why this works for this audience" }
  ],
  "contentGaps": [
    { "gap": "Missing topic 1", "suggestedTopic": "How to fill it", "viralPotential": "High" },
    { "gap": "Missing topic 2", "suggestedTopic": "How to fill it", "viralPotential": "Medium" }
  ],
  "hashtagClusters": {
    "growth": ["#tag1", "#tag2", "#tag3"],
    "niche": ["#tag4", "#tag5", "#tag6"],
    "viral": ["#tag7", "#tag8", "#tag9"]
  },
  "userVsCompetitor": {
    "userStrength": "What the user is doing better",
    "userWeakness": "Where competitors are winning",
    "quickWin": "Actionable step to beat them"
  },
  "keyInsights": [
    "Crucial insight 1",
    "Crucial insight 2",
    "Crucial insight 3"
  ],
  "reelFramework": {
    "structure": "Hook → Problem → Solution → CTA",
    "hookDuration": "0-3 seconds — what to show",
    "problemSection": "3-15s — how to show the pain",
    "solutionSection": "15-45s — how to deliver value",
    "ctaSection": "45-60s — what CTA converts best",
    "textOverlayStrategy": "when and what type of text overlays",
    "editingPace": "cuts every X seconds",
    "audioStrategy": "trending/original/voiceover",
    "confidence": "High",
    "evidence": "pattern found in top viral posts"
  },
  "keyInsights": [
    "actionable insight 1 with evidence",
    "actionable insight 2 with evidence",
    "actionable insight 3 with evidence",
    "actionable insight 4 with evidence",
    "actionable insight 5 with evidence"
  ],
  "contentGaps": [
    {
      "gap": "specific content gap",
      "opportunity": "why this would work",
      "viralPotential": "High/Medium",
      "suggestedTopic": "exact topic to create"
    },
    {
      "gap": "gap 2",
      "opportunity": "why",
      "viralPotential": "High/Medium",
      "suggestedTopic": "exact topic"
    },
    {
      "gap": "gap 3",
      "opportunity": "why",
      "viralPotential": "High/Medium",
      "suggestedTopic": "exact topic"
    }
  ],
  "trendOpportunities": [
    {
      "trend": "trending topic/format",
      "relevance": "why relevant to this niche",
      "urgency": "act now/this week/this month",
      "contentIdea": "specific content idea to capitalize"
    },
    {
      "trend": "trend 2",
      "relevance": "why relevant",
      "urgency": "timeframe",
      "contentIdea": "idea"
    }
  ],
  "psychologicalTriggers": [
    {
      "trigger": "trigger name (e.g., Social Proof)",
      "howCompetitorUses": "how they use it",
      "howToAdapt": "how user can use same trigger uniquely"
    },
    {
      "trigger": "trigger 2",
      "howCompetitorUses": "usage",
      "howToAdapt": "adaptation"
    },
    {
      "trigger": "trigger 3",
      "howCompetitorUses": "usage",
      "howToAdapt": "adaptation"
    }
  ],
  "userVsCompetitor": {
    "userStrength": "what user does better based on data comparison",
    "userWeakness": "what competitors do better",
    "quickWin": "single fastest action to take right now",
    "30DayPlan": "high-level 30-day growth strategy"
  },
  "growthWeaknesses": [
    "weakness found in competitor strategy that user can avoid",
    "weakness 2",
    "weakness 3"
  ],
  "viralContentIdeas": [
    {
      "title": "content idea title",
      "format": "Reel/Carousel/Post",
      "hook": "exact opening line",
      "angle": "unique angle vs competitors",
      "viralPotential": "High",
      "whyItWorks": "psychological reason"
    },
    {
      "title": "idea 2",
      "format": "format",
      "hook": "hook",
      "angle": "angle",
      "viralPotential": "High",
      "whyItWorks": "reason"
    },
    {
      "title": "idea 3",
      "format": "format",
      "hook": "hook",
      "angle": "angle",
      "viralPotential": "High",
      "whyItWorks": "reason"
    }
  ],
  "recommendedNiche": "specific niche to own",
  "recommendedSubNiche": "specific sub-niche for differentiation",
  "hashtagClusters": {
    "viral": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "niche": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "community": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "small": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
  },
  "postingStrategy": {
    "frequency": "X posts/week",
    "bestDays": ["Monday", "Wednesday", "Friday"],
    "bestTimes": ["7:00 PM IST", "8:00 AM IST"],
    "contentMix": "40% Reels / 40% Carousels / 20% Posts",
    "reason": "why this works for the detected audience"
  }
}`;

    const llmResult = await callLLM({ userId, endpoint: "competitors", prompt, systemPrompt });
    const data = extractJSON(llmResult.text) || { raw: llmResult.text };

    // Validate LLM output quality
    const { valid, warnings } = validateLLMOutput(data, "competitors");
    if (!valid) console.warn("[competitors] LLM output quality warnings:", warnings);

    // Data quality scoring
    const totalPostsScraped = enhancedCompetitors.reduce((s, c) => s + c.allPosts.length, 0);
    const dataQuality = totalPostsScraped >= 20 ? "high" : totalPostsScraped >= 5 ? "medium" : enhancedCompetitors.length > 0 ? "low" : "none";
    const dataConfidence = totalPostsScraped >= 20 ? "High" : totalPostsScraped >= 5 ? "Medium" : "Low — analysis based on AI knowledge only";

    // Inject actual scraped stats into response for frontend display
    const scrapedStats = enhancedCompetitors.map(c => ({
      username: c.username,
      followers: c.profile.followers,
      bio: c.profile.bio,
      verified: c.profile.verified,
      postsCount: c.profile.postsCount,
      engagementRate: c.engagementStats.engagementRate,
      avgViews: c.engagementStats.avgViews,
      avgLikes: c.engagementStats.avgLikes,
      topPostViews: c.engagementStats.topPostViews,
      totalPostsAnalyzed: c.engagementStats.totalPostsAnalyzed,
    }));

    // Save to analysis_results for caching
    await supabase.from("analysis_results").insert({
      user_id: userId,
      platform,
      result: {
        type: "competitors",
        profileUrl,
        competitors: data,
        scrapedStats,
        rawCompetitorsData: enhancedCompetitors,
        dataSource: "apify",
      },
    });

    // Build condensed posts for frontend display (small enough for localStorage)
    const scrapedPosts = enhancedCompetitors.flatMap(c =>
      (c.allPosts || []).slice(0, 20).map((p: any) => ({
        competitor: c.username,
        caption: (p.caption || "").substring(0, 300),
        likes: p.likes || 0,
        comments: p.comments || 0,
        views: p.views || 0,
        type: p.type || "POST",
        url: p.url || "",
        hashtags: (p.hashtags || []).slice(0, 10),
      }))
    );

    return res.json({
      success: true,
      competitors: data,
      scrapedCount: enhancedCompetitors.length,
      scrapedStats,
      scrapedPosts,
      rawCompetitorsData: enhancedCompetitors,
      dataQuality,
      dataConfidence,
      totalPostsScraped,
      _warnings: valid ? [] : warnings,
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
  const { platform, niche, language, competitors, rawCompetitorsData, profileUrl } = req.body;
  const effectiveNiche = niche || "General / Auto-detect from context";

  try {
    if (!req.body.forceFresh) {
      const cached = await getCachedAnalysis(userId, platform, profileUrl, "trends");
      if (cached) {
        console.log(`[trends] Using 7-day cache for ${profileUrl}`);
        return res.json({
          success: true,
          trends: cached,
          dataSource: "cache",
          _meta: { provider: "cache", model: "cache", dataSource: "cache" }
        });
      }
    }

    let trendData: unknown[] = [];
    try {
      if (platform === "youtube") {
        trendData = await runApifyActor("streamers/youtube-scraper", {
          searchKeywords: [`${effectiveNiche} India 2025`],
          maxResults: 10,
        });
      } else {
        const tag = (effectiveNiche || "india").toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 20) || "india";
        trendData = await runApifyActor("apify/instagram-hashtag-scraper", {
          hashtags: [tag, `${tag}india`],
          resultsLimit: 15,
        }).catch(() => []);
      }
    } catch (scrapeErr: any) {
      console.warn(`[trends] Apify skipped: ${scrapeErr.message}`);
    }

    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? `Tu ek elite Indian social media trend analyst aur strategist hai. Tere paas current Indian cultural trends, viral memes, aur algorithm secrets ka deep knowledge hai. Hinglish mein jawab de. Highly specific examples de jo aajkal viral ho rahe hain. SIRF valid JSON return kar — koi extra text nahi.`
      : `You are an elite Indian social media trend analyst. Provide hyper-specific, actionable insights based on current Indian cultural trends, viral formats, and algorithm secrets. Return ONLY valid JSON.`;

    const currentMonth = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
    const competitorContext = competitors?.length
      ? `Competitor accounts being analyzed: ${competitors.join(", ")}`
      : "";

    let competitorPostsContext = "";
    if (Array.isArray(rawCompetitorsData) && rawCompetitorsData.length > 0) {
      competitorPostsContext = "\nREAL SCRAPED COMPETITOR POSTS & PERFORMANCE:\n";
      for (const comp of rawCompetitorsData) {
        competitorPostsContext += `\nCreator: @${comp.username} (Followers: ${comp.profile?.followers?.toLocaleString() || "Unknown"})\n`;
        const topPosts = Array.isArray(comp.topPosts) ? comp.topPosts.slice(0, 5) : [];
        topPosts.forEach((p: any, idx: number) => {
          competitorPostsContext += `  Post ${idx + 1}: ${p.type} | Views: ${p.views?.toLocaleString()} | Likes: ${p.likes?.toLocaleString()} | Hook: "${p.hookText || p.caption?.substring(0, 100)}"\n`;
        });
      }
    }

    const prompt = `Analyze current trending content for ${platform} creators in India in the "${effectiveNiche}" niche (${currentMonth}).
${competitorContext}
${competitorPostsContext}

${trendData.length > 0
  ? `Scraped trending data: ${JSON.stringify(trendData.slice(0, 8), null, 2).substring(0, 2000)}`
  : `Use the competitor posts above and your knowledge of current Indian ${platform} trends for ${effectiveNiche} niche. Be specific with real examples.`
}

IMPORTANT: If niche is "auto-detect", infer it from the competitor context or default to Digital Creator / Content Creator niche.
Think strategically and behaviorally. Generate deep psychological insights.

Return ONLY this JSON (no extra text, no markdown wrapper):
{
  "detectedNiche": "${niche || "inferred niche name"}",
  "audiencePsychology": [
    "deep psychological driver 1",
    "emotional trigger 2",
    "behavioral pattern 3"
  ],
  "viralPatterns": [
    "hook pattern 1",
    "content format 2",
    "visual style 3"
  ],
  "highPerformingCategories": [
    "Educational/Storytelling etc with specific angle"
  ],
  "weakContentAreas": [
    "what people are doing wrong or getting low engagement on"
  ],
  "contentGaps": [
    "untapped topic 1",
    "missing angle 2"
  ],
  "ctaInsights": [
    "what calls to action convert best in this niche"
  ],
  "viralHookSuggestions": [
    "highly viral hook 1",
    "highly viral hook 2",
    "highly viral hook 3"
  ],
  "trendPredictions": [
    "what will trend next month",
    "audio or visual format prediction"
  ],
  "growthStrategy": [
    "strategic step 1",
    "strategic step 2",
    "strategic step 3",
    "strategic step 4"
  ]
}`;

    const llmResult = await callLLM({ userId, endpoint: "trends", prompt, systemPrompt });
    const data = extractJSON(llmResult.text) || { raw: llmResult.text, trendingFormats: [], trendingTopics: [], trendingHashtags: [], viralHookFormulas: [], contentIdeas: [] };

    // Save to analysis_results for caching
    await supabase.from("analysis_results").insert({
      user_id: userId,
      platform,
      result: {
        type: "trends",
        profileUrl,
        trends: data,
        dataSource: "apify",
      },
    });

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

// --- POST /api/analyze/pipeline --- (week-by-week to avoid token limits)
router.post("/pipeline", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { platform, niche, language, profileUrl, competitors, rawCompetitorsData } = req.body;
  const effectiveNiche = niche || "Digital Creator";
  try {
    if (!req.body.forceFresh) {
      const cached = await getCachedAnalysis(userId, platform, profileUrl, "pipeline");
      if (cached) {
        console.log(`[pipeline] Using 7-day cache for ${profileUrl}`);
        return res.json({
          success: true,
          pipeline: cached,
          dataSource: "cache",
          _meta: { provider: "cache", model: "cache", dataSource: "cache" }
        });
      }
    }

    let ownData: RealProfileData | null = null;
    if (profileUrl) {
      const { data } = await getRealProfileData(userId, platform, profileUrl);
      ownData = data;
    }
    const competitorInsights = Array.isArray(competitors) && competitors.length > 0
      ? `Competitor accounts: ${competitors.join(", ")} - model content on their viral patterns.`
      : "";
    const userContext = ownData
      ? `Creator: @${ownData.username} | ${ownData.followers.toLocaleString()} followers | ${ownData.engagementRate || 0}% ER | Bio: "${ownData.biography || "Not set"}"`
      : `Platform: ${platform} | Niche: ${effectiveNiche} | Indian audience`;
    
    const isHindi = language === "hi";
    const lang = isHindi ? "Hinglish" : "English";

    // Get current date context for relevancy
    const now = new Date();
    const currentMonth = now.toLocaleString("en-IN", { month: "long", year: "numeric" });
    const currentDay = now.toLocaleString("en-IN", { weekday: "long" });

    // Indian calendar awareness
    const INDIAN_EVENTS: Record<number, string[]> = {
      1: ["New Year", "Makar Sankranti", "Republic Day", "Budget season"],
      2: ["Valentine's Week", "Board exam season"],
      3: ["Holi", "Women's Day", "Board exams", "IPL starts"],
      4: ["Ram Navami", "IPL season", "New financial year"],
      5: ["Akshaya Tritiya", "Mother's Day", "Summer vacation"],
      6: ["Father's Day", "Monsoon begins", "International Yoga Day"],
      7: ["Guru Purnima", "Monsoon season", "Independence Day prep"],
      8: ["Independence Day", "Raksha Bandhan", "Janmashtami"],
      9: ["Ganesh Chaturthi", "Teacher's Day", "Navratri starts"],
      10: ["Navratri", "Dussehra", "Karwa Chauth", "Diwali prep"],
      11: ["Diwali", "Bhai Dooj", "Children's Day", "Black Friday"],
      12: ["Christmas", "New Year prep", "Year-end reviews"],
    };
    const upcomingEvents = INDIAN_EVENTS[now.getMonth() + 1] || [];
    
    const systemPrompt = isHindi
      ? `Tu world-class Indian social media content strategist aur copywriter hai jo natural, high-converting Hinglish content likhta hai.
RULES FOR HINGLISH:
1. Poora spoken dialogue, script aur hook conversation-ready Hinglish mein likho (Hindi words in Roman/Latin script, e.g. "Doston, kya aap bhi..." ya "Agar aapko marketing seekhni hai...").
2. Standard English technical/business words (e.g. "ads", "leads", "revenue", "strategy", "creator", "views") ko Hinglish ke saath naturally mix karo.
3. Devanagari script (Hindi characters like "नमस्ते") bilkul use nahi karna hai. Script strictly Roman alphabet mein likho.
4. Script dialogue absolute professional aur casual record-ready hona chahiye. 

STRICT RULE AGAINST PLACEHOLDERS:
- Do NOT use ANY bracketed placeholder like [Your Name], [Niche], [Product Name], [Brand], [Insert Link], etc.
- In-place values generate karo. Make up realistic generic names/values so the script is 100% ready to use immediately.

Return ONLY a valid JSON object. No explanation, no markdown wrappers.`
      : `You are a world-class Indian social media content strategist and copywriter.
RULES:
1. Write in a highly natural, engaging, and conversational tone native to Indian audience.
2. Every field must contain actual, ready-to-use content.
3. STRICTLY FORBIDDEN: Do not use ANY placeholders like [Your Name], [Your Product], [Niche], [insert link here]. Generate realistic generic names or concrete details instead so that the script can be read word-for-word immediately.

Return ONLY a valid JSON object. No explanation, no markdown wrappers.`;
    
    // Upgraded: 7 days of unique Reels (as requested: 7 day content, 7 unique reels only)
    const WEEK_DEFS = [
      { week: 1, theme: "Viral 7-Day Reel Strategy (2026 Trends)",
        days: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
        formats: ["Reel","Reel","Reel","Reel","Reel","Reel","Reel"],
        angles: ["Myth vs Fact (High curiosity)", "Step-by-Step Tutorial (High value)", "Personal Story/Failure (High relatability)", "Contrarian Opinion/Hot Take (High engagement)", "Tool/Resource Reveal (High saves)", "Behind the Scenes/Process (High trust)", "Actionable Checklist (High shares)"]
      }
    ];

    let competitorPostsContext = "";
    if (Array.isArray(rawCompetitorsData) && rawCompetitorsData.length > 0) {
      competitorPostsContext = "\nREAL SCRAPED COMPETITOR POSTS & PERFORMANCE:\n";
      for (const comp of rawCompetitorsData) {
        competitorPostsContext += `\nCreator: @${comp.username} (Followers: ${comp.profile?.followers?.toLocaleString() || "Unknown"})\n`;
        const topPosts = Array.isArray(comp.topPosts) ? comp.topPosts.slice(0, 5) : [];
        topPosts.forEach((p: any, idx: number) => {
          competitorPostsContext += `  Post ${idx + 1}: ${p.type} | Views: ${p.views?.toLocaleString()} | Likes: ${p.likes?.toLocaleString()} | Hook: "${p.hookText || p.caption?.substring(0, 100)}"\n`;
        });
      }
    }

    // Import placeholder stripper
    const { countPlaceholders, stripPlaceholders } = await import("../services/llm");

    const buildPostPrompt = (wd: typeof WEEK_DEFS[0], postIdx: number, compContext: string) => {
      const day = wd.days[postIdx];
      const format = wd.formats[postIdx];
      const angle = wd.angles[postIdx];
      const postNumber = (wd.week - 1) * 7 + postIdx + 1;
      
      // Calculate suggested posting time based on day
      const timeSuggestions: Record<string, string> = {
        "Monday": "8:30 AM IST", "Tuesday": "12:30 PM IST", "Wednesday": "7:00 PM IST",
        "Thursday": "9:00 AM IST", "Friday": "6:30 PM IST", "Saturday": "10:00 AM IST",
        "Sunday": "11:00 AM IST",
      };

      return `Generate exactly 1 highly realistic, publication-ready post (#${postNumber}/28) for ${platform} in the niche "${effectiveNiche}".
      
CREATOR PROFILE: ${userContext}
WEEK ${wd.week} THEME: "${wd.theme}"
POST DETAILS: ${day} | Format: ${format} | Language: ${lang}
REQUIRED ANGLE/FRAMEWORK FOR THIS POST: **${angle}**
SUGGESTED TIME: ${timeSuggestions[day] || "7:00 PM IST"}
DATE CONTEXT: ${currentMonth} | Events: ${upcomingEvents.join(", ") || "None special"}
${competitorInsights}
${req.body.growthStrategy?.length ? `GROWTH STRATEGY TO FOLLOW: ${req.body.growthStrategy.join(", ")}\n` : ""}
${compContext}

CRITICAL RULES:
1. NO PLACEHOLDERS — every word must be real, usable content. No [brackets] allowed.
2. STRICT UNIQUE ANGLE: You MUST use the exact Required Angle/Framework ("${angle}").
3. BAN GENERIC ADVICE: Do NOT suggest extremely basic, outdated tools or advice that everyone knows. Provide DIRECT VALUABLE ANSWERS to specific problems. Do not waste the user's time.
4. EXACT STRUCTURE REQUIRED: You must format your script EXACTLY like the "GOLD STANDARD EXAMPLE" below (numbered transitions). HOWEVER, DO NOT COPY THE TOPIC (AI SEO). You MUST generate a COMPLETELY UNIQUE topic based strictly on the user's niche (${effectiveNiche}) and the Required Angle (${angle}).
5. 20-SECOND SCRIPT LIMIT: The spoken script must take exactly 20 seconds to speak at a normal pace (around 50-60 words total). Keep it punchy, fast-paced, and zero fluff.
6. SCROLL-STOPPING HOOK: The hook MUST evoke strong FOMO, extreme curiosity, or agitate a painful problem. No generic "Hello guys".
7. The CTA must be very specific, offering a lead magnet or detailed guide in DMs to drive follows and engagement.

GOLD STANDARD EXAMPLE OF SCRIPT PACING & FORMAT (${lang}):
"AI SEO mei rank krna hai to ye 5 cheeze miss mat krna
Sabse pehle apni robot.txt file AI KE ACCORDING bnao aur saare ai models ko allow kro crawling ke liye
Doosra ek llms.txt file bnakar website ki root directory mei daalo
Teersra agar website vibe code ya code se developed hai to automate kro sitemap generation ko backend mei ek automate script ke sath
Chautha Koi bhi heading ya para mei direct answers do user ka faltu mei time waste nahi kro
Paanchwa or last search queries ko solve kro keywords ko chase krna band kro
Detailed guide or Agli video ke liye follow krke comment kro AI DM aajayega"

Your output must be a single JSON object:
{
  "day": "${day}",
  "format": "${format}",
  "content_pillar": "Education / Entertainment / Inspiration / Authority / Community",
  "topic": "Specific compelling topic based purely on the angle '${angle}'",
  "hook": "Scroll-stopping opening line in ${lang} (max 15 words, must grab attention immediately)",
  "caption": "Full publication-ready ${lang} caption: hook + relatable story/context + 3 highly specific value points + clear CTA with emojis (150+ words minimum, zero placeholders)",
  "hashtags": ["#Tag1","#Tag2","#Tag3","#Tag4","#Tag5","#Tag6","#Tag7","#Tag8","#Tag9","#Tag10"],
  "pin_comment": "An engaging first comment in ${lang} to pin (ask a question or add extra value)",
  "posting_time": "${timeSuggestions[day] || "7:00 PM IST"}",
  "estimated_reach": "Realistic reach estimate based on follower count and content type",
  "thumbnail_description": "Detailed description of the ideal cover/thumbnail: text overlay, colors, expression, background",
  "b_roll_suggestions": ["Specific B-roll shot 1 needed", "B-roll shot 2", "B-roll shot 3"],
  "music_suggestion": "Specific trending audio name or type of background music for this post",
  "script": {
    "scene1_hook": "Exact spoken words in ${lang} for the first 3 seconds — direct FOMO or extreme curiosity hook related to ${effectiveNiche}",
    "scene2_problem": "Not needed if using direct numbered format, but can add 1 line of context if necessary",
    "scene3_solution": "Exact spoken words in ${lang} delivering 3 to 5 specific actionable tips using numbered transitions (Sabse pehle, Doosra...) — concrete, hyper-specific to the angle '${angle}', NOT generic",
    "scene4_cta": "Exact spoken words in ${lang} for the CTA — compelling lead magnet offer in DMs",
    "voiceover_notes": "Detailed instructions: tone (excited/serious/casual), speed (fast/medium), energy level, emotional shifts, pauses",
    "text_overlays": ["Bold text for hook scene", "Tip 1 text overlay", "Tip 2 text overlay", "CTA text overlay"],
    "visual_directions": ["Scene 1: Close-up face, surprised expression", "Scene 2: Screen recording showing the problem", "Scene 3: Split screen with examples", "Scene 4: Point at camera + text overlay"]
  }
}

CRITICAL REMINDER: Zero [brackets]. Every word real and ready to record.`;
    };

    console.log(`[pipeline] Generating 1 week × 7 posts = 7 calls for: ${effectiveNiche}`);
    const contentCalendar: any[] = [];
    let provider = "gemini"; let model = "";

    const progressKey = `${userId}-${profileUrl}`;
    pipelineProgressMap.set(progressKey, 5); // Initialization

    for (let w = 0; w < WEEK_DEFS.length; w++) {
      const wd = WEEK_DEFS[w];
      
      // Process 7 posts per week in batches of 3-4 to stay within rate limits
      const posts: any[] = [];
      const batchSize = 4;
      
      for (let batchStart = 0; batchStart < 7; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, 7);
        const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i);
        
        const postPromises = batchIndices.map(pi =>
          callLLM({ userId, endpoint: `pipeline_w${wd.week}_p${pi+1}`, prompt: buildPostPrompt(wd, pi, competitorPostsContext), systemPrompt })
            .then(r => ({ ok: true as const, text: r.text, provider: r.provider, model: r.model }))
            .catch(e => ({ ok: false as const, error: e.message }))
        );
        const postResults = await Promise.all(postPromises);
        
        for (let bi = 0; bi < postResults.length; bi++) {
          const pi = batchStart + bi;
          const pr = postResults[bi];
          
          // Increment progress per post (approx 90% total for 7 posts ~ 12.8% per post)
          const currentProgress = pipelineProgressMap.get(progressKey) || 5;
          pipelineProgressMap.set(progressKey, Math.min(95, currentProgress + 12.8));

          if (!pr.ok) { console.warn(`[pipeline] w${w+1} p${pi+1} LLM failed: ${(pr as any).error}`); continue; }
          
          let parsed = extractJSON(pr.text) as any;
          if (parsed && parsed.topic && parsed.hook) {
            // Post-process: strip any remaining placeholders
            const jsonStr = JSON.stringify(parsed);
            const placeholderCount = countPlaceholders(jsonStr);
            if (placeholderCount > 0) {
              console.warn(`[pipeline] w${w+1} p${pi+1}: Found ${placeholderCount} placeholders, stripping...`);
              const cleaned = stripPlaceholders(jsonStr);
              try {
                parsed = JSON.parse(cleaned);
              } catch {
                // If JSON breaks after stripping, keep original
                console.warn(`[pipeline] w${w+1} p${pi+1}: Placeholder strip broke JSON, keeping original`);
              }
            }
            
            // Ensure required fields exist
            parsed.posting_time = parsed.posting_time || "7:00 PM IST";
            parsed.content_pillar = parsed.content_pillar || "Education";
            parsed.thumbnail_description = parsed.thumbnail_description || "Bold text overlay on gradient background";
            parsed.b_roll_suggestions = parsed.b_roll_suggestions || [];
            parsed.music_suggestion = parsed.music_suggestion || "Trending upbeat audio";
            parsed.estimated_reach = parsed.estimated_reach || "Based on similar content";
            
            posts.push(parsed);
            provider = pr.provider; model = pr.model;
          } else {
            console.warn(`[pipeline] w${w+1} p${pi+1}: JSON parse failed`);
          }
        }
      }
      
      if (posts.length > 0) {
        contentCalendar.push({ week: w+1, theme: wd.theme, posts });
        console.log(`[pipeline] Week ${w+1}: ${posts.length}/7 posts OK`);
      } else {
        console.warn(`[pipeline] Week ${w+1}: all posts failed`);
        contentCalendar.push({ week: w+1, theme: wd.theme, posts: [] });
      }
    }

    pipelineProgressMap.set(progressKey, 98); // Meta step remaining

    contentCalendar.sort((a: any, b: any) => (a.week || 0) - (b.week || 0));
    // Cap targetER: micro-accounts can produce inflated ER (e.g. 300 followers, 500 avg likes = 233%).
    const rawTargetER = ownData ? (ownData.engagementRate ?? 0) * 1.3 : 3.5;
    const targetER = Math.min(30, Math.max(3, rawTargetER)).toFixed(1);
    const metaPrompt = `Return ONLY valid JSON for ${effectiveNiche} ${platform} content strategy (replace placeholders with real values):
{"contentPillars":[{"pillar":"ACTUAL pillar 1 for ${effectiveNiche}","percentage":30,"examples":["idea1","idea2","idea3"]},{"pillar":"ACTUAL pillar 2","percentage":25,"examples":["idea1","idea2"]},{"pillar":"ACTUAL pillar 3","percentage":20,"examples":["idea1","idea2"]},{"pillar":"ACTUAL pillar 4","percentage":15,"examples":["idea1"]},{"pillar":"ACTUAL pillar 5 - Community/BTS","percentage":10,"examples":["idea1"]}],"batchingStrategy":"How to shoot all 28 posts in 3 days for ${effectiveNiche} creator - equipment, outfit changes, shooting order, location changes","postingSchedule":{"frequency":"7 posts/week (daily posting)","bestDays":["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],"bestTimes":{"Monday":"8:30 AM IST","Tuesday":"12:30 PM IST","Wednesday":"7:00 PM IST","Thursday":"9:00 AM IST","Friday":"6:30 PM IST","Saturday":"10:00 AM IST","Sunday":"11:00 AM IST"},"reason":"Why these specific times work for Indian ${effectiveNiche} audience"},"kpis":{"targetER":"${targetER}%","postingFrequency":"7/week","growthTarget":"Realistic 30-day target for ${effectiveNiche}","savesTarget":"Target save rate per post","shareTarget":"Target shares per week"}}`;
    let metaData: any = { contentPillars: [], postingSchedule: { bestDays: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], bestTimes: {"Monday":"8:30 AM IST"} }, kpis: { targetER: targetER + "%", postingFrequency: "7/week", growthTarget: "1000+ followers/month" } };
    try {
      const metaRes = await callLLM({ userId, endpoint: "pipeline_meta", prompt: metaPrompt, systemPrompt });
      const pm = extractJSON(metaRes.text) as any;
      if (pm) metaData = pm;
    } catch { console.warn("[pipeline] Meta call failed"); }
    
    const weeksWithContent = contentCalendar.filter((w: any) => w.posts?.length > 0).length;
    const totalPosts = contentCalendar.reduce((s: number, w: any) => s + (w.posts?.length || 0), 0);
    console.log(`[pipeline] Done: ${weeksWithContent}/4 weeks, ${totalPosts} total posts generated`);
    
    const pipelineFinal = { contentCalendar, contentPillars: metaData.contentPillars || [], batchingStrategy: metaData.batchingStrategy || "", postingSchedule: metaData.postingSchedule || { bestDays: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], bestTimes: {"Monday": "8:30 AM IST"} }, kpis: metaData.kpis || { targetER: targetER + "%", postingFrequency: "7/week", growthTarget: "1000+ followers/month" } };

    // Save to analysis_results for caching
    await supabase.from("analysis_results").insert({
      user_id: userId,
      platform,
      result: {
        type: "pipeline",
        profileUrl,
        pipeline: pipelineFinal,
        dataSource: "apify",
      },
    });

    return res.json({
      success: true,
      pipeline: pipelineFinal,
      hasRealContent: weeksWithContent > 0,
      weeksGenerated: weeksWithContent,
      _meta: { provider, model }
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
    // actual columns: id, user_id, platform, result, created_at
    const { data, error } = await supabase.from("analysis_results").insert({
      user_id: userId,
      platform,
      result: {
        type: "full",
        profileUrl,
        niche: niche || null,
        audit: auditData,
        competitors: competitorsData,
        trends: trendsData,
        pipeline: pipelineData,
      },
    }).select("id").single();

    if (error) throw new Error(error.message);
    return res.json({ success: true, analysisId: data.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
