"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const llm_1 = require("../services/llm");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
// Helper: extract JSON from LLM response
function extractJSON(text) {
    if (!text)
        return null;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) {
        try {
            return JSON.parse(fence[1].trim());
        }
        catch { }
    }
    try {
        return JSON.parse(text.trim());
    }
    catch { }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
        const slice = text.slice(start, end + 1);
        try {
            return JSON.parse(slice);
        }
        catch { }
        try {
            return JSON.parse(slice.replace(/,\s*([}\]])/g, "$1"));
        }
        catch { }
    }
    return null;
}
// Rule-based insights generator fallback (if LLM fails / is unconfigured)
function generateRuleBasedInsights(platform, data) {
    const er = Number(data.engagementRate) || 0;
    const followers = Number(data.followers || data.fans || data.subscribers) || 0;
    const mediaCount = Number(data.mediaCount || data.postsCount || data.videoCount) || 0;
    const posts30dCount = Number(data.posts30dCount || data.postsCount || 0);
    // Engagement Score
    let engagementScore = 50;
    if (platform === "instagram") {
        if (er >= 6)
            engagementScore = 90;
        else if (er >= 3)
            engagementScore = 75;
        else if (er >= 1.5)
            engagementScore = 55;
        else
            engagementScore = 35;
    }
    else if (platform === "facebook") {
        if (er >= 3)
            engagementScore = 85;
        else if (er >= 1.5)
            engagementScore = 65;
        else
            engagementScore = 40;
    }
    else { // youtube
        const avgViews = mediaCount > 0 ? (Number(data.totalViews) || 0) / mediaCount : 0;
        const viewToSubRatio = followers > 0 ? avgViews / followers : 0;
        if (viewToSubRatio >= 0.2)
            engagementScore = 90;
        else if (viewToSubRatio >= 0.08)
            engagementScore = 75;
        else
            engagementScore = 45;
    }
    // Consistency Score
    let consistencyScore = 40;
    if (platform === "youtube") {
        if (posts30dCount >= 4)
            consistencyScore = 85;
        else if (posts30dCount >= 2)
            consistencyScore = 65;
        else
            consistencyScore = 45;
    }
    else {
        if (posts30dCount >= 12)
            consistencyScore = 90;
        else if (posts30dCount >= 6)
            consistencyScore = 70;
        else
            consistencyScore = 45;
    }
    // Growth Score
    let growthScore = 60;
    const reachPct = data.comparison7d?.reach?.pct;
    if (reachPct !== undefined && reachPct !== null) {
        if (reachPct >= 20)
            growthScore = 85;
        else if (reachPct >= 0)
            growthScore = 70;
        else if (reachPct >= -15)
            growthScore = 50;
        else
            growthScore = 35;
    }
    // Content Score
    const contentScore = er > 4 ? 80 : 65;
    const healthScore = Math.round((engagementScore + consistencyScore + growthScore + contentScore) / 4);
    // Executive Summary
    let executiveSummary = "";
    if (platform === "instagram") {
        executiveSummary = `Your account is showing a healthy engagement rate of ${er.toFixed(1)}%. ${reachPct && reachPct < 0
            ? `However, reach dropped by ${Math.abs(reachPct)}% this week, likely due to posting only ${data.comparison7d?.posts?.current || 0} times. Focus on Reels to boost reach.`
            : "Consistency is good. Focus on adding strong CTAs to direct followers to your link in bio."}`;
    }
    else if (platform === "facebook") {
        executiveSummary = `Your Facebook Page has an engagement rate of ${er.toFixed(1)}%. ${mediaCount < 3 ? "Consistency needs improvement. Aim to post at least 3 times a week." : "Keep up the consistent scheduling to boost organic page reach."}`;
    }
    else {
        executiveSummary = `Your channel with ${followers.toLocaleString()} subscribers has published ${mediaCount} videos. Focus on engaging thumbnails and strong hooks in the first 10 seconds.`;
    }
    // AI recommendations
    const recommendations = [];
    if (platform === "instagram") {
        if (consistencyScore < 60) {
            recommendations.push({
                title: "Increase Reel frequency",
                expectedImpact: "High",
                priority: "High",
                reasoning: "Algorithm prioritizes accounts that publish 3+ times weekly, especially in Reels format.",
                suggestedAction: "Schedule 3 Reels next week using trending audio hooks."
            });
        }
        if (engagementScore < 60) {
            recommendations.push({
                title: "Use shorter hooks in Reels",
                expectedImpact: "High",
                priority: "High",
                reasoning: "Retention drops off after 3 seconds. A text hook on screen improves watch time.",
                suggestedAction: "Place a bold, 3-word title hook on screen for the first 2 seconds of your next video."
            });
        }
        else {
            recommendations.push({
                title: "Reply faster to comments",
                expectedImpact: "Medium",
                priority: "Medium",
                reasoning: "Responding to comments in the first hour signal high engagement to the algorithm.",
                suggestedAction: "Set aside 15 minutes after publishing a post to answer all immediate comments."
            });
        }
        recommendations.push({
            title: "Add 'Save for later' CTA",
            expectedImpact: "Medium",
            priority: "Medium",
            reasoning: "Saves have a higher weighting in the current feed ranking system than likes.",
            suggestedAction: "End your next caption with: 'Save this post 🔖 so you can find it later!'"
        });
    }
    else if (platform === "facebook") {
        recommendations.push({
            title: "Create interactive polls",
            expectedImpact: "Medium",
            priority: "High",
            reasoning: "Facebook algorithms heavily boost comments and votes on interactive formats.",
            suggestedAction: "Publish a simple two-choice comparison poll relative to your niche."
        });
    }
    else { // youtube
        recommendations.push({
            title: "Optimize video titles for search",
            expectedImpact: "High",
            priority: "High",
            reasoning: "Search accounts for 40%+ of traffic for new educational content creators.",
            suggestedAction: "Include high-volume search keywords in the first 50 characters of your titles."
        });
    }
    // Best Times
    const bestPostingTime = {
        days: platform === "youtube" ? ["Thursday", "Saturday", "Sunday"] : ["Monday", "Wednesday", "Friday"],
        hours: platform === "youtube" ? ["3:00 PM", "6:00 PM"] : ["7:00 PM", "9:00 PM"],
        confidenceScore: 78
    };
    // Profile Health
    const profileHealth = {
        bioOptimization: "Include clear keywords indicating your target audience.",
        ctaQuality: "Add a direct action verb pointing to your website link.",
        completeness: "85%",
        seoOptimization: "Make sure your display name has your niche search keyword included."
    };
    const topPostsAnalysis = (data.topPosts || []).map((p) => ({
        postId: p.postId || p.id,
        reason: `This post performed well due to high initial save and share ratios. The caption length was ideal for retention.`
    }));
    const underperformingPostsAnalysis = (data.topPosts || []).slice(-2).map((p) => ({
        postId: p.postId || p.id,
        reason: `Lower reach suggests the visual thumbnail failed to capture user attention in the feed.`,
        suggestion: `Republish this topic as a Reel with a clearer title overlay.`
    }));
    return {
        healthScore,
        growthScore,
        engagementScore,
        contentScore,
        consistencyScore,
        executiveSummary,
        topPostsAnalysis,
        underperformingPostsAnalysis,
        bestPostingTime,
        profileHealth,
        recommendations
    };
}
// GET /api/insights/:platform/:accountId
// Proxy for Meta Graph API insights — keeps access tokens server-side
router.get("/:platform/:accountId", async (req, res) => {
    const { platform, accountId } = req.params;
    const { userId } = req;
    const { metric, period } = req.query;
    if (platform !== "instagram" && platform !== "facebook") {
        return res.status(400).json({ error: "Unsupported platform" });
    }
    const { data: account, error: accountError } = await supabase_1.supabase
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
    const apiUrl = `https://graph.facebook.com/v21.0/${accountId}/insights` +
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
router.post("/generate-ai", async (req, res) => {
    const { userId } = req;
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
${(statsData.topPosts || []).map((p) => `* ID: ${p.postId || p.id} | Type: ${p.type} | ER: ${p.er}% | Likes: ${p.likes} | Comments: ${p.comments} | Saves: ${p.saves} | Reach: ${p.reach} | Caption snippet: "${p.caption || ''}"`).join("\n")}

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
        const response = await (0, llm_1.callLLM)({
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
    }
    catch (err) {
        console.error("[insights generate-ai error]:", err.message);
        // Silent failover to Rule-Based insights to keep service online
        const fallback = generateRuleBasedInsights(platform, statsData);
        return res.json({ aiData: fallback, _fallback: true });
    }
});
exports.default = router;
//# sourceMappingURL=insights.js.map