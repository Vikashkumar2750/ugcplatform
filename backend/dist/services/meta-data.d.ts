/**
 * meta-data.ts
 * Fetches real data from Meta Graph API for connected Instagram/Facebook accounts.
 * Used by analyze routes when user has a connected account — gives real post data
 * instead of relying on 3rd party scrapers.
 */
export interface RealPostData {
    id: string;
    caption?: string;
    likes: number;
    comments: number;
    mediaType: string;
    timestamp: string;
    permalink?: string;
    views?: number;
    saves?: number;
    reach?: number;
}
export interface RealProfileData {
    username: string;
    followers: number;
    following: number;
    mediaCount: number;
    biography?: string;
    engagementRate?: number;
    avgLikes: number;
    avgComments: number;
    posts: RealPostData[];
    platform: string;
}
export declare function fetchConnectedInstagramData(userId: string, targetUsername?: string): Promise<RealProfileData | null>;
export declare function fetchConnectedFacebookData(userId: string, targetUsername?: string): Promise<RealProfileData | null>;
