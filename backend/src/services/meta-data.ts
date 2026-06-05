/**
 * meta-data.ts
 * Fetches real data from Meta Graph API for connected Instagram/Facebook accounts.
 * Used by analyze routes when user has a connected account — gives real post data
 * instead of relying on 3rd party scrapers.
 */

import { supabase } from "../lib/supabase";

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

// Fetch real Instagram data for a user's connected account
export async function fetchConnectedInstagramData(
  userId: string,
  targetUsername?: string
): Promise<RealProfileData | null> {
  try {
    const { data: account } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", "instagram")
      .eq("is_active", true)
      .maybeSingle();

    if (!account?.access_token || !account?.platform_user_id) return null;

    // If targetUsername provided but doesn't match connected account, skip
    if (
      targetUsername &&
      account.platform_username &&
      targetUsername.toLowerCase() !== account.platform_username.toLowerCase()
    ) {
      return null;
    }

    const igId = account.platform_user_id;
    const token = account.access_token;
    const base = `https://graph.facebook.com/v21.0`;

    // 1. Profile
    const profileRes = await fetch(
      `${base}/${igId}?fields=id,username,name,biography,followers_count,follows_count,media_count&access_token=${token}`
    );
    const profile = await profileRes.json();
    if (profile.error) {
      console.warn("[meta-data] Profile fetch error:", profile.error.message);
      return null;
    }

    // 2. Recent media (last 20 posts)
    const mediaRes = await fetch(
      `${base}/${igId}/media?fields=id,timestamp,media_type,like_count,comments_count,caption,permalink&limit=20&access_token=${token}`
    );
    const mediaData = await mediaRes.json();
    const rawPosts: any[] = mediaData?.data || [];

    // 3. Get insights for top 5 posts (saves + reach)
    const enrichedPosts: RealPostData[] = await Promise.all(
      rawPosts.slice(0, 20).map(async (p: any) => {
        let saves = 0;
        let reach = 0;
        try {
          const insRes = await fetch(
            `${base}/${p.id}/insights?metric=saved,reach&access_token=${token}`
          );
          const ins = await insRes.json();
          const find = (name: string) =>
            ins?.data?.find((m: any) => m.name === name)?.values?.[0]?.value || 0;
          saves = find("saved");
          reach = find("reach");
        } catch {}

        return {
          id: p.id,
          caption: p.caption?.substring(0, 500),
          likes: p.like_count || 0,
          comments: p.comments_count || 0,
          mediaType: p.media_type || "IMAGE",
          timestamp: p.timestamp,
          permalink: p.permalink,
          saves,
          reach,
        };
      })
    );

    const followers = profile.followers_count || 0;
    const avgLikes = enrichedPosts.length
      ? Math.round(enrichedPosts.reduce((s, p) => s + p.likes, 0) / enrichedPosts.length)
      : 0;
    const avgComments = enrichedPosts.length
      ? Math.round(enrichedPosts.reduce((s, p) => s + p.comments, 0) / enrichedPosts.length)
      : 0;
    const engagementRate =
      followers > 0
        ? parseFloat((((avgLikes + avgComments) / followers) * 100).toFixed(2))
        : 0;

    return {
      username: profile.username || account.platform_username,
      followers,
      following: profile.follows_count || 0,
      mediaCount: profile.media_count || 0,
      biography: profile.biography,
      engagementRate,
      avgLikes,
      avgComments,
      posts: enrichedPosts,
      platform: "instagram",
    };
  } catch (err: any) {
    console.warn("[meta-data] fetchConnectedInstagramData failed:", err.message);
    return null;
  }
}

// Fetch real Facebook Page data for connected account
export async function fetchConnectedFacebookData(
  userId: string,
  targetUsername?: string
): Promise<RealProfileData | null> {
  try {
    const { data: account } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", "facebook")
      .eq("is_active", true)
      .maybeSingle();

    if (!account?.access_token || !account?.platform_user_id) return null;

    if (
      targetUsername &&
      account.platform_username &&
      targetUsername.toLowerCase() !== account.platform_username.toLowerCase()
    ) {
      return null;
    }

    const pageId = account.platform_user_id;
    const token = account.access_token;
    const base = `https://graph.facebook.com/v21.0`;

    const pageRes = await fetch(
      `${base}/${pageId}?fields=id,name,username,fan_count,followers_count,biography&access_token=${token}`
    );
    const page = await pageRes.json();
    if (page.error) return null;

    const postsRes = await fetch(
      `${base}/${pageId}/posts?fields=id,message,created_time,reactions.summary(true),comments.summary(true)&limit=20&access_token=${token}`
    );
    const postsData = await postsRes.json();
    const rawPosts: any[] = postsData?.data || [];

    const posts: RealPostData[] = rawPosts.map((p: any) => ({
      id: p.id,
      caption: p.message?.substring(0, 500),
      likes: p.reactions?.summary?.total_count || 0,
      comments: p.comments?.summary?.total_count || 0,
      mediaType: "POST",
      timestamp: p.created_time,
    }));

    const followers = page.fan_count || page.followers_count || 0;
    const avgLikes = posts.length ? Math.round(posts.reduce((s, p) => s + p.likes, 0) / posts.length) : 0;
    const avgComments = posts.length ? Math.round(posts.reduce((s, p) => s + p.comments, 0) / posts.length) : 0;
    const engagementRate = followers > 0
      ? parseFloat((((avgLikes + avgComments) / followers) * 100).toFixed(2))
      : 0;

    return {
      username: page.username || page.name || account.platform_username,
      followers,
      following: 0,
      mediaCount: posts.length,
      biography: page.biography,
      engagementRate,
      avgLikes,
      avgComments,
      posts,
      platform: "facebook",
    };
  } catch (err: any) {
    console.warn("[meta-data] fetchConnectedFacebookData failed:", err.message);
    return null;
  }
}
