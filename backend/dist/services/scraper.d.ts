export interface ScrapeResult {
    posts: ScrapedPost[];
    profile?: ProfileInfo;
}
export interface ScrapedPost {
    id: string;
    caption?: string;
    likes?: number;
    comments?: number;
    views?: number;
    timestamp?: string;
    mediaUrl?: string;
    url?: string;
    type?: string;
    hashtags?: string[];
}
export interface ProfileInfo {
    username: string;
    fullName?: string;
    followers?: number;
    following?: number;
    posts?: number;
    bio?: string;
    verified?: boolean;
    isBusinessAccount?: boolean;
    profilePicUrl?: string;
}
export interface EnhancedCompetitorData {
    username: string;
    profile: {
        fullName: string;
        followers: number;
        following: number;
        postsCount: number;
        bio: string;
        verified: boolean;
        isBusinessAccount: boolean;
        profilePicUrl?: string;
    };
    topPosts: EnhancedPost[];
    recentPosts: EnhancedPost[];
    allPosts: EnhancedPost[];
    engagementStats: {
        avgLikes: number;
        avgComments: number;
        avgViews: number;
        engagementRate: number;
        topPostViews: number;
        totalPostsAnalyzed: number;
    };
}
export interface EnhancedPost {
    id: string;
    type: string;
    caption: string;
    hashtags: string[];
    likes: number;
    comments: number;
    views: number;
    timestamp: string;
    url: string;
    captionLength: number;
    hasQuestion: boolean;
    hasCTA: boolean;
    hookText: string;
}
export declare function scrapeInstagramProfile(username: string, userKeys?: {
    rapidapi?: string;
    apify?: string;
}): Promise<ScrapeResult>;
export declare function scrapeCompetitorFull(username: string, userKeys?: {
    rapidapi?: string;
    apify?: string;
}): Promise<EnhancedCompetitorData>;
export declare function scrapeInstagramProfileFull(username: string): Promise<{
    profile: ProfileInfo;
    topPosts: ScrapedPost[];
    recentPosts: ScrapedPost[];
}>;
export declare function searchFacebookGroups(query: string): Promise<ScrapeResult>;
export declare function scrapeYouTubeChannel(channelId: string): Promise<ScrapeResult>;
export declare function scrapeLinkedInProfile(username: string): Promise<ScrapeResult>;
export declare function scrapeLinkedInCompany(domain: string): Promise<ScrapeResult>;
export declare function runApifyActor(actorId: string, input: Record<string, unknown>, userKeys?: {
    apify?: string;
}): Promise<any[]>;
