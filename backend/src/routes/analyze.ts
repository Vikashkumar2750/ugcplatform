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

const router = Router();
router.use(requireAuth);

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
    // Get user's own real data first (for comparison baseline)
    let ownData: RealProfileData | null = null;
    if (profileUrl) {
      const { data } = await getRealProfileData(userId, platform, profileUrl);
      ownData = data;
    }

    // ── ENHANCED: Scrape EACH competitor using BOTH Apify actors ─────────────
    let enhancedCompetitors: EnhancedCompetitorData[] = [];
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

    if (targetCompetitors?.length && platform === "instagram") {
      const usernames = targetCompetitors
        .map((url: string) => extractUsername(url, "instagram"))
        .filter(Boolean)
        .slice(0, 3);

      console.log(`[competitors] Starting enhanced Apify scrape for: ${usernames.join(", ")}`);

      const results = await Promise.allSettled(
        usernames.map((u: string) => scrapeCompetitorFull(u))
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

SIRF real scraped data use karo — koi hallucination nahi. Hinglish mein jawab de. SIRF valid JSON return karo.`
      : `You are an elite AI Content Intelligence Engine trained in:
- Performance marketing & creator economy
- Social media psychology & viral content analysis
- Instagram growth strategy & trend forecasting
- Audience retention & engagement optimization

RULES: Use ONLY real scraped data. Never hallucinate metrics. Return ONLY valid JSON.`;

    const ownSection = ownData
      ? `USER's OWN ACCOUNT (@${ownData.username}):
- Followers: ${ownData.followers.toLocaleString()} | Following: ${ownData.following}
- Avg Likes: ${ownData.avgLikes} | Avg Comments: ${ownData.avgComments}
- Engagement Rate: ${ownData.engagementRate}%
- Bio: "${ownData.biography || "Not set"}"
- Total Posts: ${ownData.mediaCount}`
      : `User Platform: ${platform} | Niche: ${niche || "to be detected"}`;

    // Build rich competitor data section
    const buildCompetitorSection = (c: EnhancedCompetitorData, i: number) => `
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

TOP 5 VIRAL POSTS (by views):
${c.topPosts.slice(0, 5).map((p, pi) => `  #${pi + 1} [${p.type}] Views:${p.views.toLocaleString()} Likes:${p.likes.toLocaleString()}
   Hook: "${p.hookText.substring(0, 80)}"
   Tags: ${p.hashtags.slice(0, 6).join(" ")} | CTA:${p.hasCTA}`).join("\n")}

TOP HASHTAGS: ${[...new Set(c.allPosts.flatMap(p => p.hashtags))].slice(0, 12).join(" ")}
`;

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
    {
      "formula": "second hook formula",
      "example": "real example",
      "emotionalTrigger": "trigger type",
      "avgViews": "avg views",
      "confidence": "High/Medium"
    },
    {
      "formula": "third hook formula",
      "example": "real example",
      "emotionalTrigger": "trigger type",
      "avgViews": "avg views",
      "confidence": "High/Medium"
    }
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

    return res.json({
      success: true,
      competitors: data,
      scrapedCount: enhancedCompetitors.length,
      scrapedStats,
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
  const { platform, niche, language, competitors, rawCompetitorsData } = req.body;
  const effectiveNiche = niche || "General / Auto-detect from context";

  try {
    let trendData: unknown[] = [];
    try {
      if (platform === "youtube") {
        trendData = await runApifyActor("streamers/youtube-scraper", {
          searchKeywords: [`${effectiveNiche} India 2025`],
          maxResults: 10,
        });
      } else {
        // Scrape trending niche hashtag posts for trend signal
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
      ? `Tu Indian social media trend expert hai. Hinglish mein specific examples do. SIRF valid JSON return kar — koi extra text nahi.`
      : `You are an Indian social media trend expert. Give SPECIFIC trending content examples with real numbers. Return ONLY valid JSON.`;

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

Return ONLY this JSON (no extra text, no markdown wrapper):
{
  "detectedNiche": "${niche || "inferred niche name"}",
  "trendingFormats": [
    { "format": "specific format name", "growth": "+X%", "type": "Reel/Carousel/Post", "whyItWorks": "specific reason with Indian context" }
  ],
  "trendingTopics": [
    { "topic": "specific topic name in ${effectiveNiche}", "searchVolume": "High/Medium/Low", "competition": "High/Medium/Low", "contentAngle": "specific angle to take" }
  ],
  "trendingHashtags": ["#HashTag1", "#HashTag2", "#HashTag3", "#HashTag4", "#HashTag5", "#HashTag6", "#HashTag7", "#HashTag8"],
  "trendingAudio": ["Audio trend 1 for Reels", "Audio trend 2"],
  "seasonalOpportunity": "Specific ${currentMonth} opportunity — e.g. festival, exam season, weather event relevant to Indian ${effectiveNiche} creators",
  "viralHookFormulas": [
    { "formula": "exact hook structure", "example": "Example hook in ${isHindi ? "Hinglish" : "English"} for ${effectiveNiche}", "emotion": "Curiosity/Fear/Relatability/Inspiration" },
    { "formula": "second hook formula", "example": "Another example", "emotion": "emotion type" },
    { "formula": "third hook formula", "example": "Third example", "emotion": "emotion type" }
  ],
  "contentIdeas": [
    "Specific viral idea 1 for ${effectiveNiche} with hook line",
    "Specific viral idea 2 based on current trend",
    "Specific viral idea 3 — collaboration or challenge format",
    "Specific viral idea 4 — educational or informational",
    "Specific viral idea 5 — trending format applied to ${effectiveNiche}"
  ]
}`;

    const llmResult = await callLLM({ userId, endpoint: "trends", prompt, systemPrompt });
    const data = extractJSON(llmResult.text) || { raw: llmResult.text, trendingFormats: [], trendingTopics: [], trendingHashtags: [], viralHookFormulas: [], contentIdeas: [] };

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

    const WEEK_DEFS = [
      { week: 1, theme: "Awareness - Introduce your expertise and hook new audience", formats: ["Reel","Carousel","Post"] },
      { week: 2, theme: "Education - Teach your best tips and build trust",           formats: ["Reel","Carousel","Reel"] },
      { week: 3, theme: "Engagement - Community stories and behind-the-scenes",      formats: ["Reel","Post","Carousel"] },
      { week: 4, theme: "Authority - Results transformation and strong CTA",         formats: ["Reel","Carousel","Reel"] },
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

    const buildPostPrompt = (wd: { week: number; theme: string; formats: string[] }, postIdx: number, compContext: string) => {
      const days = ["Monday","Wednesday","Friday"];
      const day = days[postIdx];
      const format = wd.formats[postIdx];
      return `Generate exactly 1 highly realistic, publication-ready post for ${platform} in the niche "${effectiveNiche}".
      
CREATOR PROFILE: ${userContext}
WEEK ${wd.week} THEME: "${wd.theme}"
POST DETAILS: ${day} | Format: ${format} | Language: ${lang}
${competitorInsights}
${compContext}

Your output must be a single JSON object matching this schema. Replace all placeholder explanations with real, high-quality, concrete copy:
{
  "day": "${day}",
  "format": "${format}",
  "topic": "Specific compelling topic for this post (e.g. '3 tools for scaling leads')",
  "hook": "Scroll-stopping opening hook line in ${lang} (max 15 words, must grab attention)",
  "caption": "Full publication-ready ${lang} caption: a hook line + relatable story/context + 3 highly specific value points + clear CTA with emojis (100+ words, no placeholders)",
  "hashtags": ["#Tag1","#Tag2","#Tag3","#Tag4","#Tag5","#Tag6","#Tag7","#Tag8","#Tag9","#Tag10"],
  "pin_comment": "An engaging, scroll-starting comment in ${lang} to pin under the post",
  "script": {
    "scene1_hook": "Exact spoken words in ${lang} for the first 3 seconds (must be exactly what the creator says out loud to camera)",
    "scene2_problem": "Exact spoken words in ${lang} explaining the problem/pain point [0:03-0:15]",
    "scene3_solution": "Exact spoken words in ${lang} explaining the solution or 3 specific tips [0:15-0:45]",
    "scene4_cta": "Exact spoken words in ${lang} for the call-to-action [0:45-0:60]",
    "voiceover_notes": "Instructions for tone, speed, energy, and emotions during delivery",
    "text_overlays": ["Text overlay for hook","Text overlay for tip 1","CTA overlay"]
  }
}

CRITICAL: Every word in "caption", "hook", "pin_comment", and "script" fields MUST be in natural, conversational ${lang}. Absolutely zero placeholders or brackets. Make the copy highly engaging and native.`;
    };

    console.log(`[pipeline] Generating 4 weeks × 3 posts = 12 calls for: ${effectiveNiche}`);
    const contentCalendar: any[] = [];
    let provider = "gemini"; let model = "";

    for (let w = 0; w < WEEK_DEFS.length; w++) {
      const wd = WEEK_DEFS[w];
      const postPromises = [0,1,2].map(pi =>
        callLLM({ userId, endpoint: `pipeline_w${wd.week}_p${pi+1}`, prompt: buildPostPrompt(wd, pi, competitorPostsContext), systemPrompt })
          .then(r => ({ ok: true as const, text: r.text, provider: r.provider, model: r.model }))
          .catch(e => ({ ok: false as const, error: e.message }))
      );
      const postResults = await Promise.all(postPromises);
      // Poll for completion (max 25s = 5 × 5s — fits within Render's 30s response timeout)
      const posts: any[] = [];
      for (let pi = 0; pi < postResults.length; pi++) {
        const pr = postResults[pi];
        if (!pr.ok) { console.warn(`[pipeline] w${w+1} p${pi+1} LLM failed: ${(pr as any).error}`); continue; }
        const parsed = extractJSON(pr.text) as any;
        if (parsed && parsed.topic && parsed.hook) {
          posts.push(parsed);
          provider = pr.provider; model = pr.model;
        } else {
          console.warn(`[pipeline] w${w+1} p${pi+1}: JSON parse failed`);
        }
      }
      if (posts.length > 0) {
        contentCalendar.push({ week: w+1, theme: wd.theme, posts });
        console.log(`[pipeline] Week ${w+1}: ${posts.length}/3 posts OK`);
      } else {
        console.warn(`[pipeline] Week ${w+1}: all posts failed`);
        contentCalendar.push({ week: w+1, theme: wd.theme, posts: [] });
      }
    }

    contentCalendar.sort((a: any, b: any) => (a.week || 0) - (b.week || 0));
    // Cap targetER: micro-accounts can produce inflated ER (e.g. 300 followers, 500 avg likes = 233%).
    // A realistic growth target should be capped at 30% and floored at 3%.
    const rawTargetER = ownData ? (ownData.engagementRate ?? 0) * 1.3 : 3.5;
    const targetER = Math.min(30, Math.max(3, rawTargetER)).toFixed(1);
    const metaPrompt = `Return ONLY valid JSON for ${effectiveNiche} ${platform} content strategy (replace placeholders with real values):
{"contentPillars":[{"pillar":"ACTUAL pillar 1 for ${effectiveNiche}","percentage":40,"examples":["idea1","idea2","idea3"]},{"pillar":"ACTUAL pillar 2","percentage":30,"examples":["idea1","idea2"]},{"pillar":"ACTUAL pillar 3","percentage":20,"examples":["idea1","idea2"]},{"pillar":"ACTUAL pillar 4","percentage":10,"examples":["idea1"]}],"batchingStrategy":"How to shoot all 12 posts in 2 days for ${effectiveNiche} creator - equipment, outfit changes, shooting order","postingSchedule":{"frequency":"3 posts/week","bestDays":["Monday","Wednesday","Friday"],"bestTimes":["7:00 PM - 9:00 PM IST"],"reason":"Why this time works for Indian ${effectiveNiche} audience"},"kpis":{"targetER":"${targetER}%","postingFrequency":"3/week","growthTarget":"Realistic 30-day target for ${effectiveNiche}"}}`;
    let metaData: any = { contentPillars: [], postingSchedule: { bestDays: ["Monday","Wednesday","Friday"], bestTimes: ["7:00 PM IST"] }, kpis: { targetER: targetER + "%", postingFrequency: "3/week", growthTarget: "500+ followers/month" } };
    try {
      const metaRes = await callLLM({ userId, endpoint: "pipeline_meta", prompt: metaPrompt, systemPrompt });
      const pm = extractJSON(metaRes.text) as any;
      if (pm) metaData = pm;
    } catch { console.warn("[pipeline] Meta call failed"); }
    const weeksWithContent = contentCalendar.filter((w: any) => w.posts?.length > 0).length;
    console.log(`[pipeline] Done: ${weeksWithContent}/4 weeks have content`);
    return res.json({
      success: true,
      pipeline: { contentCalendar, contentPillars: metaData.contentPillars || [], batchingStrategy: metaData.batchingStrategy || "", postingSchedule: metaData.postingSchedule || { bestDays: ["Monday","Wednesday","Friday"], bestTimes: ["7 PM IST"] }, kpis: metaData.kpis || { targetER: targetER + "%", postingFrequency: "3/week", growthTarget: "500+ followers/month" } },
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
