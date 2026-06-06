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

    // ── Scrape EACH competitor with full profile + top posts ───────────────
    interface CompetitorScraped {
      username: string;
      profile: { followers: number; following: number; posts: number; bio: string };
      topPosts: Array<{ caption: string; likes: number; comments: number; views: number; url: string }>;
      recentPosts: Array<{ caption: string; likes: number; views: number }>;
    }
    let scrapedCompetitors: CompetitorScraped[] = [];

    if (competitors?.length && platform === "instagram") {
      const usernames = competitors
        .map((url: string) => extractUsername(url, "instagram"))
        .filter(Boolean)
        .slice(0, 3);

      const results = await Promise.allSettled(
        usernames.map(async (u: string) => {
          const { posts, profile } = await scrapeInstagramProfile(u);
          // Sort by views (most viral first), then by likes
          const sorted = [...posts].sort((a, b) => ((b.views || b.likes || 0) - (a.views || a.likes || 0)));
          const recent = [...posts].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
          return {
            username: u,
            profile: {
              followers: profile?.followers || 0,
              following: profile?.following || 0,
              posts: profile?.posts || posts.length,
              bio: profile?.bio || "",
            },
            topPosts: sorted.slice(0, 8).map(p => ({
              caption: (p.caption || "").substring(0, 150),
              likes: p.likes || 0,
              comments: p.comments || 0,
              views: p.views || 0,
              url: p.url || "",
            })),
            recentPosts: recent.slice(0, 5).map(p => ({
              caption: (p.caption || "").substring(0, 100),
              likes: p.likes || 0,
              views: p.views || 0,
            })),
          };
        })
      );

      scrapedCompetitors = results
        .filter(r => r.status === "fulfilled")
        .map((r: any) => r.value);

      console.log(`[competitors] Scraped ${scrapedCompetitors.length} competitors with profile data`);
    }

    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? `Tu expert social media analyst hai. SIRF REAL data use kar jo diya gaya hai — koi bhi numbers hallucinate mat karo. Agar real data hai to exactly wahi use karo. Hinglish mein jawab de. SIRF valid JSON return kar.`
      : `You are an expert social media analyst. Use ONLY the REAL scraped data provided — do NOT invent or hallucinate numbers. Use exact follower counts, likes, views from the data. Return ONLY valid JSON.`;

    const ownSection = ownData
      ? `USER'S ACCOUNT (@${ownData.username}):
- Followers: ${ownData.followers.toLocaleString()}
- Avg Likes: ${ownData.avgLikes} | Avg Comments: ${ownData.avgComments}
- Engagement Rate: ${ownData.engagementRate}%
- Bio: "${ownData.biography || ""}"`
      : `User platform: ${platform} | Niche: ${niche || "unknown"}`;

    // Build competitor data section with REAL numbers
    const competitorSection = scrapedCompetitors.length > 0
      ? scrapedCompetitors.map((c, i) => `
COMPETITOR ${i + 1}: @${c.username}
- REAL Followers: ${c.profile.followers.toLocaleString()}
- Bio: "${c.profile.bio}"
- Total Posts: ${c.profile.posts}

TOP VIRAL POSTS (sorted by views — most viral first):
${c.topPosts.map((p, pi) => `  #${pi + 1}: Views: ${p.views.toLocaleString()} | Likes: ${p.likes.toLocaleString()} | Comments: ${p.comments} | Caption: "${p.caption}"`).join("\n")}

MOST RECENT POSTS:
${c.recentPosts.map((p, pi) => `  #${pi + 1}: Views: ${p.views.toLocaleString()} | Likes: ${p.likes.toLocaleString()} | Caption: "${p.caption}"`).join("\n")}
`).join("\n---\n")
      : `Competitor URLs provided: ${competitors?.join(", ") || "None"}\n(No scraped data — use AI knowledge about these creators)`;

    // Auto-detect niche from competitor data if not provided
    const nicheSection = niche
      ? `Content Niche: ${niche}`
      : `NICHE NOT SPECIFIED — Detect niche from competitor bio/content above and fill "detectedNiche" field`;

    const prompt = `Analyze these ${platform} competitors and provide ACCURATE analysis using ONLY the real data provided:

${ownSection}

${competitorSection}

${nicheSection}

IMPORTANT RULES:
1. Use the EXACT follower numbers from the scraped data (e.g., if data says ${scrapedCompetitors[0]?.profile?.followers?.toLocaleString() || "X"} followers, use that)
2. Calculate engagement rate from real data: (avg likes + avg comments) / followers * 100
3. Identify which content topics got the MOST views — base all strategy on those
4. Find patterns in the top viral posts' captions — what hooks/topics work
5. Strategy must be based on what ACTUALLY went viral for the competitor

Return JSON:
{
  "detectedNiche": "${niche || "auto-detect from competitor content"}",
  "competitors": [
    {
      "username": "@handle (exact from data)",
      "realFollowers": "exact number from scraped data",
      "estimatedFollowers": "same as realFollowers",
      "engagementRate": "calculated from real likes/followers",
      "postingFrequency": "estimated from post count",
      "hookStyle": "pattern observed in their TOP VIRAL post captions",
      "contentStyle": "based on top viral posts",
      "captionStyle": "short/long/question-based/story-based",
      "topHashtags": ["hashtags found in their viral posts"],
      "viralTopics": ["topic from top post 1", "topic from top post 2", "topic from top post 3"],
      "viralHook": "exact hook formula from their most viral post",
      "avgViralViews": "average views of top 3 posts"
    }
  ],
  "keyInsights": [
    "insight based on REAL viral content analysis",
    "what content format gets most views for these competitors",
    "what topics drive highest engagement"
  ],
  "gapsToExploit": [
    "specific content gap not covered by competitors",
    "topic that is trending but competitors aren't covering",
    "format that works elsewhere but not used here"
  ],
  "userVsCompetitor": {
    "userStrength": "based on real ER and follower comparison",
    "userWeakness": "what competitors do better based on viral content",
    "quickWin": "single most viral content type to copy immediately with topic suggestion"
  },
  "viralContentBlueprint": {
    "topPerformingFormat": "Reel/Carousel/Post",
    "topPerformingTopic": "most common topic in viral posts",
    "topPerformingHook": "hook structure that gets most views",
    "optimalLength": "seconds for reels or slides for carousel"
  },
  "recommendedNiche": "${niche || "detected niche"}",
  "recommendedSubNiche": "specific sub-niche to own"
}`;

    const llmResult = await callLLM({ userId, endpoint: "competitors", prompt, systemPrompt });
    const data = extractJSON(llmResult.text) || { raw: llmResult.text };

    return res.json({
      success: true,
      competitors: data,
      scrapedCount: scrapedCompetitors.length,
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
