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
      ? "Tu expert Indian content strategist hai. Har post ke liye POORI script, poora caption, hashtags aur pin comment de. SIRF valid JSON return kar — no extra text, no markdown outside JSON."
      : "You are an expert Indian content strategist. For EVERY post give COMPLETE script/content, full caption, hashtags, and pin comment. Return ONLY valid JSON.";

    const dataSection = ownData
      ? `USER REAL DATA:
- @${ownData.username} | ${ownData.followers.toLocaleString()} followers | ${ownData.engagementRate}% ER
- Avg likes: ${ownData.avgLikes} | Avg comments: ${ownData.avgComments}
- Bio: "${ownData.biography || "Not set"}"
- Best posts: ${ownData.posts.sort((a, b) => b.likes - a.likes).slice(0, 3).map(p => `"${(p.caption || "").substring(0, 80)}" (${p.likes}L, ${p.comments}C)`).join(" | ")}`
      : `Platform: ${platform}, Niche: ${niche || "General"}`;

    const prompt = `Create a COMPLETE 30-day content pipeline for a ${platform} ${niche} creator.

${dataSection}
Competitors: ${Array.isArray(competitors) ? competitors.join(", ") : "None"}

CRITICAL RULES:
1. ALL 4 WEEKS must have posts — do NOT leave any week empty
2. Each week has exactly 3 posts: Mon(Reel), Wed(Carousel), Fri(Post/Reel)
3. For REEL: write complete scene-by-scene script with actual dialogues
4. For POST/CAROUSEL: write complete text content with positioning
5. Every post MUST have: full caption (150+ words), 15 hashtags, and a pin_comment
6. Content must be specific to ${niche} niche, Indian audience, in ${isHindi ? "Hinglish" : "English"}

Return this EXACT JSON structure (no deviation):
{
  "contentCalendar": [
    {
      "week": 1,
      "theme": "Week 1 theme specific to ${niche}",
      "posts": [
        {
          "day": "Mon",
          "format": "Reel",
          "topic": "Specific topic for ${niche}",
          "hook": "First 3-second hook line in ${isHindi ? "Hinglish" : "English"}",
          "script": {
            "scene1_hook": "[0:00-0:03] Camera direct pe. Exact dialogue: 'YOUR HOOK HERE' — deliver with energy, point at camera",
            "scene2_problem": "[0:03-0:15] Show the problem. Dialogue + action: 'Most people do X wrong because...' — use text overlay",
            "scene3_solution": "[0:15-0:45] Step by step solution. Dialogue for each step with b-roll instructions",
            "scene4_cta": "[0:45-0:60] CTA scene. Exact words: 'Comment WORD below and I'll send you...' — smile at camera",
            "voiceover_notes": "Tone: energetic/calm/educational. Pacing: fast cuts every 3s. Background: clean/at gym/outdoor",
            "text_overlays": ["Text 1 at 0:05", "Text 2 at 0:20", "Text 3 at 0:40"]
          },
          "caption": "Full 150+ word caption starting with hook, including story, value, and CTA. Must feel personal and authentic for Indian ${niche} audience. Include emojis naturally.",
          "hashtags": ["#Hashtag1", "#Hashtag2", "#Hashtag3", "#Hashtag4", "#Hashtag5", "#Hashtag6", "#Hashtag7", "#Hashtag8", "#Hashtag9", "#Hashtag10", "#Hashtag11", "#Hashtag12", "#Hashtag13", "#Hashtag14", "#Hashtag15"],
          "pin_comment": "Pinned comment text — usually a question to boost engagement or a resource link"
        },
        {
          "day": "Wed",
          "format": "Carousel",
          "topic": "Carousel topic for ${niche}",
          "hook": "Slide 1 hook text",
          "script": {
            "slide1": "SLIDE 1 — Hook slide. Big bold text: 'EXACT TEXT'. Subtext: 'explanation'. Background: color/gradient",
            "slide2": "SLIDE 2 — Point 1. Main text: ''. Supporting text: ''. Visual: icon/image suggestion",
            "slide3": "SLIDE 3 — Point 2. Main text: ''. Supporting text: ''",
            "slide4": "SLIDE 4 — Point 3. Main text: ''. Supporting text: ''",
            "slide5": "SLIDE 5 — Point 4 or Case study. Main text: ''",
            "slide6": "SLIDE 6 — Summary/Recap. Main text: ''",
            "slide7": "SLIDE 7 — CTA slide. Text: 'Save this for later' + follow CTA. DM hook if applicable",
            "design_notes": "Color scheme, font style, overall aesthetic guidance"
          },
          "caption": "Full carousel caption — start with question hook, tease the content, end with 'Save karo taaki bhool na jao'",
          "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4", "#Tag5", "#Tag6", "#Tag7", "#Tag8", "#Tag9", "#Tag10", "#Tag11", "#Tag12", "#Tag13", "#Tag14", "#Tag15"],
          "pin_comment": "Save karo ye post! Kaunsa point sabse helpful laga? Comment mein batao 👇"
        },
        {
          "day": "Fri",
          "format": "Post",
          "topic": "Post topic for ${niche}",
          "hook": "Caption first line hook",
          "script": {
            "image_description": "What should the image show — pose, setting, text overlay, expression, colors",
            "text_on_image": "Any text that appears on the image itself (bold quote or stat)",
            "positioning": "How to stand/sit, what to hold, camera angle (eye level/above/below), lighting setup",
            "expression_direction": "Emotion to convey — confident, relatable, happy, serious",
            "content_type": "Single image / infographic / quote card / behind-the-scenes"
          },
          "caption": "Full post caption — personal story opening, 3-5 value points numbered, end with strong CTA question to drive comments",
          "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4", "#Tag5", "#Tag6", "#Tag7", "#Tag8", "#Tag9", "#Tag10", "#Tag11", "#Tag12", "#Tag13", "#Tag14", "#Tag15"],
          "pin_comment": "Comment mein batao: [engaging question related to the post topic]"
        }
      ]
    },
    {
      "week": 2,
      "theme": "Week 2 different theme for ${niche}",
      "posts": [
        { "day": "Mon", "format": "Reel", "topic": "", "hook": "", "script": { "scene1_hook": "", "scene2_problem": "", "scene3_solution": "", "scene4_cta": "", "voiceover_notes": "", "text_overlays": [] }, "caption": "", "hashtags": [], "pin_comment": "" },
        { "day": "Wed", "format": "Carousel", "topic": "", "hook": "", "script": { "slide1": "", "slide2": "", "slide3": "", "slide4": "", "slide5": "", "slide6": "", "slide7": "", "design_notes": "" }, "caption": "", "hashtags": [], "pin_comment": "" },
        { "day": "Fri", "format": "Reel", "topic": "", "hook": "", "script": { "scene1_hook": "", "scene2_problem": "", "scene3_solution": "", "scene4_cta": "", "voiceover_notes": "", "text_overlays": [] }, "caption": "", "hashtags": [], "pin_comment": "" }
      ]
    },
    {
      "week": 3,
      "theme": "Week 3 theme — community/engagement focus",
      "posts": [
        { "day": "Mon", "format": "Reel", "topic": "", "hook": "", "script": { "scene1_hook": "", "scene2_problem": "", "scene3_solution": "", "scene4_cta": "", "voiceover_notes": "", "text_overlays": [] }, "caption": "", "hashtags": [], "pin_comment": "" },
        { "day": "Wed", "format": "Post", "topic": "", "hook": "", "script": { "image_description": "", "text_on_image": "", "positioning": "", "expression_direction": "", "content_type": "" }, "caption": "", "hashtags": [], "pin_comment": "" },
        { "day": "Fri", "format": "Carousel", "topic": "", "hook": "", "script": { "slide1": "", "slide2": "", "slide3": "", "slide4": "", "slide5": "", "slide6": "", "slide7": "", "design_notes": "" }, "caption": "", "hashtags": [], "pin_comment": "" }
      ]
    },
    {
      "week": 4,
      "theme": "Week 4 theme — authority/results/transformation",
      "posts": [
        { "day": "Mon", "format": "Reel", "topic": "", "hook": "", "script": { "scene1_hook": "", "scene2_problem": "", "scene3_solution": "", "scene4_cta": "", "voiceover_notes": "", "text_overlays": [] }, "caption": "", "hashtags": [], "pin_comment": "" },
        { "day": "Wed", "format": "Carousel", "topic": "", "hook": "", "script": { "slide1": "", "slide2": "", "slide3": "", "slide4": "", "slide5": "", "slide6": "", "slide7": "", "design_notes": "" }, "caption": "", "hashtags": [], "pin_comment": "" },
        { "day": "Fri", "format": "Reel", "topic": "", "hook": "", "script": { "scene1_hook": "", "scene2_problem": "", "scene3_solution": "", "scene4_cta": "", "voiceover_notes": "", "text_overlays": [] }, "caption": "", "hashtags": [], "pin_comment": "" }
      ]
    }
  ],
  "contentPillars": [
    { "pillar": "pillar name", "percentage": 40, "examples": ["example 1", "example 2", "example 3"] }
  ],
  "batchingStrategy": "How to batch-create all 12 posts in one day — shooting order, tools needed",
  "postingSchedule": {
    "frequency": "3 posts/week",
    "bestDays": ["Monday", "Wednesday", "Friday"],
    "bestTimes": ["7:00 PM - 9:00 PM IST"],
    "reason": "Why this timing works specifically for Indian ${niche} audience"
  },
  "kpis": {
    "targetER": "${ownData ? ((ownData.engagementRate ?? 0) * 1.5).toFixed(1) : "3.5"}%",
    "postingFrequency": "3/week",
    "growthTarget": "Realistic follower growth target for 30 days"
  }
}

IMPORTANT: Fill in ALL empty string fields with real, specific, detailed content. Every script must have actual dialogues, not placeholders.`;

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
