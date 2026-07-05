/**
 * Advanced Intelligence Engine
 * Processes raw social media posts into actionable insights, calculating
 * weighted metrics (Viral Score, Engagement Rate), extracting hooks, and categorizing content.
 */
export interface IntelligencePost {
    id: string;
    caption: string;
    likes: number;
    comments: number;
    views: number;
    timestamp?: string;
    url?: string;
    type?: string;
}
export interface EnrichedPost extends IntelligencePost {
    hook: string;
    content_category: string;
    engagement_rate: number;
    viral_score: number;
    discussion_score: number;
    comment_to_view_ratio: number;
    hashtags: string[];
}
export interface AggregatedIntelligence {
    performance_summary: {
        avg_views: number;
        avg_likes: number;
        avg_comments: number;
        avg_engagement: number;
    };
    trend_intelligence: {
        dominant_hook_types: {
            type: string;
            count: number;
        }[];
        dominant_content_categories: {
            category: string;
            count: number;
        }[];
        top_hashtags: {
            tag: string;
            count: number;
        }[];
        cta_patterns: {
            hook: string;
            category: string;
            engagement: number;
            caption: string;
        }[];
    };
    top_hooks: {
        hook: string;
        category: string;
        views: number;
        likes: number;
        engagement_rate: number;
        viral_score: number;
    }[];
    top_posts: EnrichedPost[];
}
/**
 * Clean caption and extract the first 15 words as a "hook"
 */
export declare function extractHook(caption?: string): string;
/**
 * Detect the content category based on keywords
 */
export declare function detectContentCategory(caption?: string): string;
/**
 * Detect hook psychological type
 */
export declare function detectHookType(hook?: string): string;
/**
 * Extract hashtags from caption
 */
export declare function extractHashtags(caption?: string): string[];
/**
 * Convert raw post data into Enriched Post with calculated metrics
 */
export declare function enrichPost(post: IntelligencePost): EnrichedPost;
/**
 * Aggregate an array of posts into advanced intelligence
 */
export declare function aggregateIntelligence(rawPosts: IntelligencePost[]): AggregatedIntelligence;
