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

    // ── ENHANCED: Scrape EACH competitor using BOTH Apify actors ─────────────
    let enhancedCompetitors: EnhancedCompetitorData[] = [];

    if (competitors?.length && platform === "instagram") {
      const usernames = competitors
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
- Verified: ${c.profile.verified} | Business: ${c.profile.isBusinessAccount}
- Bio: "${c.profile.bio}"

ENGAGEMENT STATS (from ${c.engagementStats.totalPostsAnalyzed} posts):
- Avg Likes: ${c.engagementStats.avgLikes.toLocaleString()}
- Avg Comments: ${c.engagementStats.avgComments.toLocaleString()}
- Avg Views: ${c.engagementStats.avgViews.toLocaleString()}
- Engagement Rate: ${c.engagementStats.engagementRate}%
- Top Post Views: ${c.engagementStats.topPostViews.toLocaleString()}

TOP 8 VIRAL POSTS (sorted by views):
${c.topPosts.map((p, pi) => `  #${pi + 1} [${p.type}] Views:${p.views.toLocaleString()} Likes:${p.likes.toLocaleString()} Comments:${p.comments}
   Hook: "${p.hookText.substring(0, 120)}"
   Hashtags: ${p.hashtags.slice(0, 8).join(" ")}
   Has CTA: ${p.hasCTA} | Has Question: ${p.hasQuestion} | Caption Length: ${p.captionLength}`).join("\n")}

MOST RECENT 5 POSTS:
${c.recentPosts.map((p, pi) => `  #${pi + 1} [${p.type}] Views:${p.views.toLocaleString()} | "${p.hookText.substring(0, 80)}"`).join("\n")}

POST TYPE DISTRIBUTION:
${(() => {
  const types = c.allPosts.reduce((acc: Record<string, number>, p) => { acc[p.type || "IMAGE"] = (acc[p.type || "IMAGE"] || 0) + 1; return acc; }, {});
  return Object.entries(types).map(([t, count]) => `  ${t}: ${count} posts`).join("\n");
})()}

TOP HASHTAGS USED:
${[...new Set(c.allPosts.flatMap(p => p.hashtags))].slice(0, 20).join(" ")}
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
  const { platform, niche, language, competitors } = req.body;
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
        const tag = (niche || "india").toLowerCase().replace(/\s/g, "");
        trendData = await runApifyActor("apify/instagram-scraper", {
          directUrls: [`https://www.instagram.com/explore/tags/${tag}/`],
          resultsLimit: 15,
        });
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

    const prompt = `Analyze current trending content for ${platform} creators in India in the "${effectiveNiche}" niche (${currentMonth}).
${competitorContext}

${trendData.length > 0
  ? `Scraped trending data: ${JSON.stringify(trendData.slice(0, 8), null, 2).substring(0, 2000)}`
  : `No scraped data available. Use your knowledge of June 2025 Indian ${platform} trends for ${effectiveNiche} niche. Be specific with real examples.`
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

// ─── POST /api/analyze/pipeline ──────────────────────────────────────────────────
router.post("/pipeline", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { platform, niche, language, profileUrl, competitors } = req.body;
  const effectiveNiche = niche || "Digital Creator";

  try {
    // Get real data for personalized pipeline
    let ownData: RealProfileData | null = null;
    if (profileUrl) {
      const { data } = await getRealProfileData(userId, platform, profileUrl);
      ownData = data;
    }

    const WEEK_THEMES: Record<string, string[]> = {
      default: [
        "Awareness — Introduce your expertise & hook new audience",
        "Education — Teach your best tips & build trust",
        "Engagement — Community, stories & behind-the-scenes",
        "Authority — Results, transformation & strong CTA",
      ],
    };
    const themes = WEEK_THEMES.default;

    const competitorInsights = Array.isArray(competitors) && competitors.length > 0
      ? `Based on competitor analysis of: ${competitors.join(", ")}\nModel the content strategy on their viral content patterns.`
      : "";

    const userContext = ownData
      ? `Creator: @${ownData.username} | ${ownData.followers.toLocaleString()} followers | ${ownData.engagementRate || 0}% ER | Bio: "${ownData.biography || "Not set"}"\nTop performing content: ${ownData.posts.sort((a, b) => b.likes - a.likes).slice(0, 2).map(p => `"${(p.caption || "").substring(0, 60)}"`).join(", ")}`
      : `Platform: ${platform} | Niche: ${effectiveNiche} | Indian audience`;

    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? "Tu world-class Indian content strategist hai. Har post ke liye POORI script likho — actual dialogues, real slide text, real caption. SIRF valid JSON return karo, koi bhi extra text nahi."
      : "You are a world-class Indian content strategist. Write COMPLETE scripts with ACTUAL dialogues, real slide text, full captions. Return ONLY valid JSON — no text outside JSON.";

    const lang = isHindi ? "Hinglish (mix of Hindi and English)" : "English";

    const prompt = `You are a world-class Indian content strategist. Create a DETAILED 4-week ${platform} content pipeline for a ${effectiveNiche} creator.

CREATOR CONTEXT:
${userContext}
${competitorInsights}

LANGUAGE: ${lang}
TARGET: Indian audience, age 18-35

WEEK THEMES (use these exact themes):
Week 1: ${themes[0]}
Week 2: ${themes[1]}  
Week 3: ${themes[2]}
Week 4: ${themes[3]}

RULES FOR EVERY POST:
- REEL: Write scene-by-scene script with ACTUAL dialogue (not generic descriptions)
- CAROUSEL: Write actual text for each slide (what's written on each slide)
- POST: Describe exact photo + full caption text
- Caption: Min 100 words, personal + value-driven, end with engaging question
- Hashtags: 15 specific ones (mix of large, medium, small — specific to ${effectiveNiche})
- Pin comment: Always include — either a question to boost comments OR a resource offer

Return ONLY this JSON (absolutely no text outside JSON):
{
  "contentCalendar": [
    {
      "week": 1,
      "theme": "${themes[0]}",
      "posts": [
        {
          "day": "Mon",
          "format": "Reel",
          "topic": "Write the ACTUAL specific topic here for ${effectiveNiche} niche Week 1",
          "hook": "Write the ACTUAL first 3-second hook line here",
          "script": {
            "scene1_hook": "[0:00-0:03] Write ACTUAL dialogue: 'Your hook here.' Action: point at camera/show visual proof",
            "scene2_problem": "[0:03-0:15] Write ACTUAL problem dialogue: 'Most people struggle with...' Show the relatable pain point",
            "scene3_solution": "[0:15-0:45] Write ACTUAL step-by-step: 'Step 1: ... Step 2: ... Step 3: ...' with specific ${effectiveNiche} tips",
            "scene4_cta": "[0:45-0:60] Write ACTUAL CTA: 'Comment X below if you want Y...' Smile, direct to camera",
            "voiceover_notes": "Tone: [specify]. Pacing: [specify]. Setting: [specify for ${effectiveNiche}]. Music: trending audio",
            "text_overlays": ["Overlay 1 text at timestamp", "Overlay 2 text", "Overlay 3 text"]
          },
          "caption": "Write the FULL caption here — start with hook, personal story, 3 value points, strong CTA. Minimum 100 words. Add relevant emojis. For ${effectiveNiche} Indian audience.",
          "hashtags": ["#Specific1", "#Specific2", "#Specific3", "#Specific4", "#Specific5", "#Specific6", "#Specific7", "#Specific8", "#Specific9", "#Specific10", "#Specific11", "#Specific12", "#Specific13", "#Specific14", "#Specific15"],
          "pin_comment": "Write the ACTUAL pin comment here — either a question or resource offer"
        },
        {
          "day": "Wed",
          "format": "Carousel",
          "topic": "Write the ACTUAL carousel topic for ${effectiveNiche} Week 1",
          "hook": "Write the slide 1 hook text",
          "script": {
            "slide1": "HOOK SLIDE — Write ACTUAL big text: '...' Subtext: '...' Background color/gradient suggestion",
            "slide2": "SLIDE 2 — Point 1: Write ACTUAL tip text. Visual: describe the visual",
            "slide3": "SLIDE 3 — Point 2: Write ACTUAL tip text",
            "slide4": "SLIDE 4 — Point 3: Write ACTUAL tip text",
            "slide5": "SLIDE 5 — Point 4 or Case Study: Write ACTUAL content",
            "slide6": "SLIDE 6 — Summary: Write ACTUAL recap text",
            "slide7": "SLIDE 7 — CTA: 'Save this! Comment below: [question]. Follow for more ${effectiveNiche} tips'",
            "design_notes": "Color: [specify]. Font: Bold sans-serif. Template: [describe aesthetic for ${effectiveNiche}]"
          },
          "caption": "Write FULL carousel caption — question hook, tease slides, end with save CTA",
          "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4", "#Tag5", "#Tag6", "#Tag7", "#Tag8", "#Tag9", "#Tag10", "#Tag11", "#Tag12", "#Tag13", "#Tag14", "#Tag15"],
          "pin_comment": "Write ACTUAL pin comment"
        },
        {
          "day": "Fri",
          "format": "Post",
          "topic": "Write the ACTUAL post topic for ${effectiveNiche} Week 1",
          "hook": "Write the ACTUAL first caption line hook",
          "script": {
            "image_description": "Write EXACTLY what to shoot — outfit, setting, props, background for ${effectiveNiche}",
            "text_on_image": "Write ACTUAL text that goes ON the image if any",
            "positioning": "Camera angle, distance, pose/expression direction",
            "expression_direction": "Emotion: confident/relatable/happy — specific direction",
            "content_type": "Single portrait / Quote card / Infographic / Behind the scenes"
          },
          "caption": "Write FULL post caption — personal story, numbered value points, CTA question at end",
          "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4", "#Tag5", "#Tag6", "#Tag7", "#Tag8", "#Tag9", "#Tag10", "#Tag11", "#Tag12", "#Tag13", "#Tag14", "#Tag15"],
          "pin_comment": "Write ACTUAL pin comment"
        }
      ]
    },
    {
      "week": 2,
      "theme": "${themes[1]}",
      "posts": [
        {
          "day": "Mon",
          "format": "Reel",
          "topic": "Write Week 2 Reel topic — education angle for ${effectiveNiche}",
          "hook": "Write Week 2 Reel hook",
          "script": { "scene1_hook": "Write ACTUAL dialogue", "scene2_problem": "Write ACTUAL dialogue", "scene3_solution": "Write ACTUAL step-by-step", "scene4_cta": "Write ACTUAL CTA", "voiceover_notes": "Direction notes", "text_overlays": ["Overlay 1", "Overlay 2"] },
          "caption": "Write FULL Week 2 Reel caption",
          "hashtags": ["#Tag1","#Tag2","#Tag3","#Tag4","#Tag5","#Tag6","#Tag7","#Tag8","#Tag9","#Tag10","#Tag11","#Tag12","#Tag13","#Tag14","#Tag15"],
          "pin_comment": "Write Week 2 pin comment"
        },
        {
          "day": "Wed",
          "format": "Carousel",
          "topic": "Write Week 2 Carousel topic",
          "hook": "Write Week 2 carousel hook",
          "script": { "slide1": "Write ACTUAL slide 1", "slide2": "Write ACTUAL slide 2", "slide3": "Write ACTUAL slide 3", "slide4": "Write ACTUAL slide 4", "slide5": "Write ACTUAL slide 5", "slide6": "Write ACTUAL slide 6", "slide7": "Write ACTUAL CTA slide", "design_notes": "Design direction" },
          "caption": "Write FULL Week 2 carousel caption",
          "hashtags": ["#Tag1","#Tag2","#Tag3","#Tag4","#Tag5","#Tag6","#Tag7","#Tag8","#Tag9","#Tag10","#Tag11","#Tag12","#Tag13","#Tag14","#Tag15"],
          "pin_comment": "Write Week 2 carousel pin comment"
        },
        {
          "day": "Fri",
          "format": "Reel",
          "topic": "Write Week 2 Friday Reel topic",
          "hook": "Write Week 2 Friday hook",
          "script": { "scene1_hook": "Write ACTUAL dialogue", "scene2_problem": "Write ACTUAL dialogue", "scene3_solution": "Write ACTUAL step-by-step", "scene4_cta": "Write ACTUAL CTA", "voiceover_notes": "Direction", "text_overlays": ["Overlay 1", "Overlay 2"] },
          "caption": "Write FULL caption",
          "hashtags": ["#Tag1","#Tag2","#Tag3","#Tag4","#Tag5","#Tag6","#Tag7","#Tag8","#Tag9","#Tag10","#Tag11","#Tag12","#Tag13","#Tag14","#Tag15"],
          "pin_comment": "Write pin comment"
        }
      ]
    },
    {
      "week": 3,
      "theme": "${themes[2]}",
      "posts": [
        {
          "day": "Mon",
          "format": "Reel",
          "topic": "Write Week 3 Reel topic — community angle",
          "hook": "Write Week 3 hook",
          "script": { "scene1_hook": "Write ACTUAL dialogue", "scene2_problem": "Write ACTUAL dialogue", "scene3_solution": "Write ACTUAL step-by-step", "scene4_cta": "Write ACTUAL CTA", "voiceover_notes": "Direction", "text_overlays": ["Overlay 1"] },
          "caption": "Write FULL caption",
          "hashtags": ["#Tag1","#Tag2","#Tag3","#Tag4","#Tag5","#Tag6","#Tag7","#Tag8","#Tag9","#Tag10","#Tag11","#Tag12","#Tag13","#Tag14","#Tag15"],
          "pin_comment": "Write pin comment"
        },
        {
          "day": "Wed",
          "format": "Post",
          "topic": "Write Week 3 Post topic — behind the scenes",
          "hook": "Write Week 3 Post hook",
          "script": { "image_description": "Write what to shoot", "text_on_image": "Text on image", "positioning": "Camera direction", "expression_direction": "Emotion", "content_type": "Content type" },
          "caption": "Write FULL caption",
          "hashtags": ["#Tag1","#Tag2","#Tag3","#Tag4","#Tag5","#Tag6","#Tag7","#Tag8","#Tag9","#Tag10","#Tag11","#Tag12","#Tag13","#Tag14","#Tag15"],
          "pin_comment": "Write pin comment"
        },
        {
          "day": "Fri",
          "format": "Carousel",
          "topic": "Write Week 3 Carousel topic",
          "hook": "Write Week 3 Carousel hook",
          "script": { "slide1": "Write ACTUAL slide 1", "slide2": "Write ACTUAL slide 2", "slide3": "Write ACTUAL slide 3", "slide4": "Write ACTUAL slide 4", "slide5": "Write ACTUAL slide 5", "slide6": "Write ACTUAL slide 6", "slide7": "Write ACTUAL CTA slide", "design_notes": "Design direction" },
          "caption": "Write FULL caption",
          "hashtags": ["#Tag1","#Tag2","#Tag3","#Tag4","#Tag5","#Tag6","#Tag7","#Tag8","#Tag9","#Tag10","#Tag11","#Tag12","#Tag13","#Tag14","#Tag15"],
          "pin_comment": "Write pin comment"
        }
      ]
    },
    {
      "week": 4,
      "theme": "${themes[3]}",
      "posts": [
        {
          "day": "Mon",
          "format": "Reel",
          "topic": "Write Week 4 Reel topic — transformation story",
          "hook": "Write Week 4 Reel hook",
          "script": { "scene1_hook": "Write ACTUAL dialogue", "scene2_problem": "Write ACTUAL dialogue", "scene3_solution": "Write ACTUAL step-by-step", "scene4_cta": "Write ACTUAL CTA", "voiceover_notes": "Direction", "text_overlays": ["Overlay 1"] },
          "caption": "Write FULL caption",
          "hashtags": ["#Tag1","#Tag2","#Tag3","#Tag4","#Tag5","#Tag6","#Tag7","#Tag8","#Tag9","#Tag10","#Tag11","#Tag12","#Tag13","#Tag14","#Tag15"],
          "pin_comment": "Write pin comment"
        },
        {
          "day": "Wed",
          "format": "Carousel",
          "topic": "Write Week 4 Carousel topic — authority builder",
          "hook": "Write Week 4 Carousel hook",
          "script": { "slide1": "Write ACTUAL slide 1", "slide2": "Write ACTUAL slide 2", "slide3": "Write ACTUAL slide 3", "slide4": "Write ACTUAL slide 4", "slide5": "Write ACTUAL slide 5", "slide6": "Write ACTUAL slide 6", "slide7": "Write ACTUAL CTA slide", "design_notes": "Design direction" },
          "caption": "Write FULL caption",
          "hashtags": ["#Tag1","#Tag2","#Tag3","#Tag4","#Tag5","#Tag6","#Tag7","#Tag8","#Tag9","#Tag10","#Tag11","#Tag12","#Tag13","#Tag14","#Tag15"],
          "pin_comment": "Write pin comment"
        },
        {
          "day": "Fri",
          "format": "Reel",
          "topic": "Write Week 4 Friday Reel topic — strong closer",
          "hook": "Write Week 4 Friday hook",
          "script": { "scene1_hook": "Write ACTUAL dialogue", "scene2_problem": "Write ACTUAL dialogue", "scene3_solution": "Write ACTUAL step-by-step", "scene4_cta": "Write ACTUAL CTA", "voiceover_notes": "Direction", "text_overlays": ["Overlay 1"] },
          "caption": "Write FULL caption",
          "hashtags": ["#Tag1","#Tag2","#Tag3","#Tag4","#Tag5","#Tag6","#Tag7","#Tag8","#Tag9","#Tag10","#Tag11","#Tag12","#Tag13","#Tag14","#Tag15"],
          "pin_comment": "Write pin comment"
        }
      ]
    }
  ],
  "contentPillars": [
    { "pillar": "Write pillar 1 name for ${effectiveNiche}", "percentage": 40, "examples": ["Example post idea 1", "Example post idea 2", "Example post idea 3"] },
    { "pillar": "Write pillar 2 name", "percentage": 30, "examples": ["Example 1", "Example 2", "Example 3"] },
    { "pillar": "Write pillar 3 name", "percentage": 20, "examples": ["Example 1", "Example 2"] },
    { "pillar": "Write pillar 4 name", "percentage": 10, "examples": ["Example 1"] }
  ],
  "batchingStrategy": "Write specific batching advice for this creator — how to shoot all 12 posts in 1-2 days with equipment list and shooting order",
  "postingSchedule": {
    "frequency": "3 posts/week",
    "bestDays": ["Monday", "Wednesday", "Friday"],
    "bestTimes": ["7:00 PM - 9:00 PM IST", "8:00 AM - 10:00 AM IST on weekends"],
    "reason": "Write WHY this timing works for Indian ${effectiveNiche} audience specifically"
  },
  "kpis": {
    "targetER": "${ownData ? (Math.max(3, ((ownData.engagementRate ?? 0) * 1.5))).toFixed(1) : "3.5"}%",
    "postingFrequency": "3/week",
    "growthTarget": "Write realistic 30-day follower growth target with reasoning"
  }
}

REMEMBER: Replace every "Write ACTUAL..." placeholder with REAL specific content for ${effectiveNiche} niche. The output must be immediately usable by a creator — no placeholders left.`;

    const llmResult = await callLLM({ userId, endpoint: "pipeline", prompt, systemPrompt });
    const rawData = extractJSON(llmResult.text);

    // Validate that we got real content (not just template placeholders)
    const pipelineData: any = rawData || {};
    const calendar = pipelineData.contentCalendar || [];

    // Check if AI actually filled content or returned empty/placeholder
    const hasRealContent = calendar.length > 0 && calendar.some((week: any) =>
      week.posts?.some((post: any) =>
        post.topic && !post.topic.includes("Write") && !post.topic.includes("ACTUAL")
      )
    );

    if (!hasRealContent && calendar.length > 0) {
      console.warn("[pipeline] AI returned template placeholders — content not filled");
    }

    return res.json({
      success: true,
      pipeline: pipelineData,
      hasRealContent,
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
