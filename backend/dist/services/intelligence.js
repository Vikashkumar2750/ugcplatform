"use strict";
/**
 * Advanced Intelligence Engine
 * Processes raw social media posts into actionable insights, calculating
 * weighted metrics (Viral Score, Engagement Rate), extracting hooks, and categorizing content.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractHook = extractHook;
exports.detectContentCategory = detectContentCategory;
exports.detectHookType = detectHookType;
exports.extractHashtags = extractHashtags;
exports.enrichPost = enrichPost;
exports.aggregateIntelligence = aggregateIntelligence;
/**
 * Clean caption and extract the first 15 words as a "hook"
 */
function extractHook(caption = "") {
    const safeCaption = caption || "";
    const cleanCaption = safeCaption
        .replace(/[#]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const sentences = cleanCaption
        .split(/[.!?\n]/)
        .map((v) => v.trim())
        .filter((v) => v.length > 10);
    let hook = sentences[0] || "";
    hook = hook
        .replace(/follow us/gi, "")
        .replace(/follow krke/gi, "")
        .replace(/follow/gi, "")
        .replace(/comment/gi, "")
        .replace(/dm/gi, "")
        .replace(/prompt guide/gi, "")
        .replace(/save this/gi, "")
        .replace(/#\w+/g, "")
        .replace(/@\w+/g, "")
        .replace(/\s+/g, " ")
        .split(" ")
        .slice(0, 18)
        .join(" ")
        .trim();
    if (hook.startsWith("@") || hook.startsWith("http") || hook.length < 10) {
        hook = "";
    }
    return hook.slice(0, 140);
}
/**
 * Detect the content category based on keywords
 */
function detectContentCategory(caption = "") {
    const c = (caption || "").toLowerCase();
    if (c.includes("how to") || c.includes("tutorial") || c.includes("step by step"))
        return "Tutorial";
    if (c.includes("story") || c.includes("dark") || c.includes("reality"))
        return "Storytelling";
    if (c.includes("ai") || c.includes("seo") || c.includes("marketing"))
        return "Educational";
    if (c.includes("meme") || c.includes("funny"))
        return "Entertainment";
    return "Generic";
}
/**
 * Detect hook psychological type
 */
function detectHookType(hook = "") {
    const h = (hook || "").toLowerCase();
    if (h.includes("secret") || h.includes("truth") || h.includes("reality") || h.includes("nobody tells"))
        return "Curiosity";
    if (h.includes("dark") || h.includes("story") || h.includes("scary"))
        return "Storytelling";
    if (h.includes("ai") || h.includes("seo") || h.includes("marketing") || h.includes("growth"))
        return "Educational";
    if (h.includes("comment") || h.includes("dm") || h.includes("follow"))
        return "CTA";
    if (h.includes("mistake") || h.includes("wrong"))
        return "Mistake Hook";
    return "Generic";
}
/**
 * Extract hashtags from caption
 */
function extractHashtags(caption = "") {
    const matches = (caption || "").match(/#[\w]+/g);
    return matches ? matches.map((tag) => tag.toLowerCase()) : [];
}
/**
 * Convert raw post data into Enriched Post with calculated metrics
 */
function enrichPost(post) {
    const caption = post.caption || "";
    const likes = post.likes || 0;
    const comments = post.comments || 0;
    const views = post.views || 0;
    // Normalized metrics to prevent skewed data
    const normalizedComments = Math.min(comments, Math.max(likes * 3, 50));
    // Weighted engagement gives slight edge to comments (meaningful interaction)
    const weightedEngagement = ((likes * 1) + (normalizedComments * 0.15)) / Math.max(views, 1) * 100;
    // Viral score: views get small weight, likes get medium, comments get high weight
    const viralScore = (likes * 2) + (comments * 3) + (views * 0.01);
    const discussionScore = comments / Math.max(likes, 1);
    const commentToViewRatio = comments / Math.max(views, 1);
    return {
        ...post,
        hook: extractHook(caption),
        content_category: detectContentCategory(caption),
        engagement_rate: Number(weightedEngagement.toFixed(2)),
        viral_score: Number(viralScore.toFixed(2)),
        discussion_score: Number(discussionScore.toFixed(2)),
        comment_to_view_ratio: Number(commentToViewRatio.toFixed(4)),
        hashtags: extractHashtags(caption).slice(0, 15),
    };
}
/**
 * Aggregate an array of posts into advanced intelligence
 */
function aggregateIntelligence(rawPosts) {
    const posts = rawPosts.map(enrichPost);
    const hookPatterns = {};
    const categoryMap = {};
    const hashtagMap = {};
    const ctaPatterns = [];
    for (const post of posts) {
        const hookType = detectHookType(post.hook);
        hookPatterns[hookType] = (hookPatterns[hookType] || 0) + 1;
        const category = post.content_category || "Generic";
        categoryMap[category] = (categoryMap[category] || 0) + 1;
        for (const tag of post.hashtags) {
            hashtagMap[tag] = (hashtagMap[tag] || 0) + 1;
        }
        const captionLower = (post.caption || "").toLowerCase();
        if (captionLower.includes("comment") || captionLower.includes("dm") || captionLower.includes("follow") || captionLower.includes("save this")) {
            ctaPatterns.push({
                hook: post.hook,
                category: post.content_category,
                engagement: post.engagement_rate,
                caption: (post.caption || "").slice(0, 120),
            });
        }
    }
    const filteredHooks = posts.filter((p) => p.hook && p.hook.length > 10);
    const topHooks = [...filteredHooks]
        .sort((a, b) => b.viral_score - a.viral_score)
        .slice(0, 10)
        .map((v) => ({
        hook: v.hook,
        category: v.content_category,
        views: v.views,
        likes: v.likes,
        engagement_rate: v.engagement_rate,
        viral_score: v.viral_score,
    }));
    const topPosts = [...posts]
        .sort((a, b) => b.viral_score - a.viral_score)
        .slice(0, 5);
    const avgViews = Math.round(posts.reduce((a, b) => a + b.views, 0) / Math.max(posts.length, 1));
    const avgLikes = Math.round(posts.reduce((a, b) => a + b.likes, 0) / Math.max(posts.length, 1));
    const avgComments = Math.round(posts.reduce((a, b) => a + b.comments, 0) / Math.max(posts.length, 1));
    const avgEngagement = Number((posts.reduce((a, b) => a + b.engagement_rate, 0) / Math.max(posts.length, 1)).toFixed(2));
    return {
        performance_summary: {
            avg_views: avgViews,
            avg_likes: avgLikes,
            avg_comments: avgComments,
            avg_engagement: avgEngagement,
        },
        trend_intelligence: {
            dominant_hook_types: Object.entries(hookPatterns)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => ({ type, count })),
            dominant_content_categories: Object.entries(categoryMap)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => ({ category, count })),
            top_hashtags: Object.entries(hashtagMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([tag, count]) => ({ tag, count })),
            cta_patterns: ctaPatterns
                .sort((a, b) => b.engagement - a.engagement)
                .slice(0, 5),
        },
        top_hooks: topHooks,
        top_posts: topPosts,
    };
}
//# sourceMappingURL=intelligence.js.map