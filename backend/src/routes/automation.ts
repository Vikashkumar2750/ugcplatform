/**
 * automation.ts — Backend routes for content automation
 * POST /api/automation/schedule     — Schedule a post
 * GET  /api/automation/schedule     — Get scheduled posts
 * DELETE /api/automation/schedule/:id — Cancel scheduled post
 * POST /api/automation/publish/:id  — Manually publish now
 */

import { Router, Request, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { supabase } from "../lib/supabase";

const router = Router();
router.use(requireAuth);

// ─── GET /api/automation/schedule ─────────────────────────────────────────────
router.get("/schedule", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;

  try {
    const { data, error } = await supabase
      .from("scheduled_posts")
      .select("*")
      .eq("user_id", userId)
      .order("scheduled_at", { ascending: true });

    if (error) throw new Error(error.message);
    return res.json({ success: true, posts: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/automation/schedule ────────────────────────────────────────────
router.post("/schedule", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const {
    platform,
    accountId,
    caption,
    mediaUrl,
    mediaUrls,
    contentType,
    scheduledAt,
    title,
  } = req.body;

  if (!platform || !caption || !scheduledAt) {
    return res.status(400).json({ error: "platform, caption, and scheduledAt are required" });
  }

  // Validate scheduled time is in the future
  if (new Date(scheduledAt) <= new Date()) {
    return res.status(400).json({ error: "scheduledAt must be in the future" });
  }

  try {
    // Check user has a connected account for this platform
    const { data: account } = await supabase
      .from("connected_accounts")
      .select("id, platform_user_id, platform_username")
      .eq("user_id", userId)
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();

    if (!account) {
      return res.status(400).json({
        error: `No connected ${platform} account. Go to Connect page to link your account.`
      });
    }

    const { data, error } = await supabase
      .from("scheduled_posts")
      .insert({
        user_id: userId,
        platform,
        connected_account_id: account.id,
        platform_user_id: account.platform_user_id,
        caption,
        media_url: mediaUrl || null,
        media_urls: mediaUrls || null,
        content_type: contentType || "post",
        title: title || null,
        scheduled_at: scheduledAt,
        status: "scheduled",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return res.json({
      success: true,
      postId: data.id,
      message: `Post scheduled for ${new Date(scheduledAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
    });
  } catch (err: any) {
    console.error("[/api/automation/schedule POST]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/automation/schedule/:id ──────────────────────────────────────
router.delete("/schedule/:id", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("status", "scheduled");

    if (error) throw new Error(error.message);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/automation/publish/:id ─────────────────────────────────────────
// Manually trigger publish of a scheduled post
router.post("/publish/:id", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;

  try {
    const { data: post } = await supabase
      .from("scheduled_posts")
      .select("*, connected_accounts(access_token, platform_user_id)")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.status === "published") return res.status(400).json({ error: "Already published" });
    if (post.status === "cancelled") return res.status(400).json({ error: "Post was cancelled" });

    const account = Array.isArray(post.connected_accounts)
      ? post.connected_accounts[0]
      : post.connected_accounts;

    if (!account?.access_token) {
      return res.status(400).json({ error: "Connected account access token not found" });
    }

    let publishedPostId: string | null = null;

    // Publish via Meta Graph API
    if (post.platform === "instagram") {
      publishedPostId = await publishToInstagram({
        igId: account.platform_user_id,
        token: account.access_token,
        caption: post.caption,
        mediaUrl: post.media_url,
        mediaUrls: post.media_urls,
        contentType: post.content_type || "post",
      });
    } else if (post.platform === "facebook") {
      publishedPostId = await publishToFacebook({
        pageId: account.platform_user_id,
        token: account.access_token,
        caption: post.caption,
        mediaUrl: post.media_url,
        contentType: post.content_type || "post",
      });
    } else {
      return res.status(400).json({ error: `Publishing not supported for ${post.platform} yet` });
    }

    // Mark as published
    await supabase
      .from("scheduled_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        platform_post_id: publishedPostId,
      })
      .eq("id", id);

    return res.json({ success: true, platformPostId: publishedPostId });
  } catch (err: any) {
    console.error("[/api/automation/publish]", err.message);
    // Mark as failed
    await supabase.from("scheduled_posts").update({ status: "failed" }).eq("id", id);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Helper: Publish to Instagram ────────────────────────────────────────────
async function publishToInstagram(opts: {
  igId: string;
  token: string;
  caption: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  contentType: string;
}): Promise<string> {
  const { igId, token, caption, mediaUrl, mediaUrls, contentType } = opts;
  const base = `https://graph.facebook.com/v21.0`;

  // Carousel
  if (contentType === "carousel" && mediaUrls?.length) {
    const itemIds: string[] = [];
    for (const url of mediaUrls) {
      const r = await fetch(`${base}/${igId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: token }),
      });
      const d = await r.json();
      if (d.error) throw new Error(`IG carousel item: ${d.error.message}`);
      itemIds.push(d.id);
    }
    const containerRes = await fetch(`${base}/${igId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_type: "CAROUSEL", children: itemIds.join(","), caption, access_token: token }),
    });
    const container = await containerRes.json();
    if (container.error) throw new Error(`IG carousel container: ${container.error.message}`);
    const pubRes = await fetch(`${base}/${igId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    });
    const pub = await pubRes.json();
    if (pub.error) throw new Error(`IG publish: ${pub.error.message}`);
    return pub.id;
  }

  // Reel
  if (contentType === "reel" && mediaUrl) {
    const containerRes = await fetch(`${base}/${igId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_type: "REELS", video_url: mediaUrl, caption, access_token: token }),
    });
    const container = await containerRes.json();
    if (container.error) throw new Error(`IG reel container: ${container.error.message}`);

    // Poll for processing (max 60s)
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(`${base}/${container.id}?fields=status_code&access_token=${token}`);
      const status = await statusRes.json();
      if (status.status_code === "FINISHED") break;
      if (status.status_code === "ERROR") throw new Error("IG reel processing failed");
    }

    const pubRes = await fetch(`${base}/${igId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    });
    const pub = await pubRes.json();
    if (pub.error) throw new Error(`IG reel publish: ${pub.error.message}`);
    return pub.id;
  }

  // Photo / Story
  if (mediaUrl) {
    const containerRes = await fetch(`${base}/${igId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: mediaUrl,
        caption,
        ...(contentType === "story" ? { media_type: "STORIES" } : {}),
        access_token: token,
      }),
    });
    const container = await containerRes.json();
    if (container.error) throw new Error(`IG photo container: ${container.error.message}`);

    const pubRes = await fetch(`${base}/${igId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    });
    const pub = await pubRes.json();
    if (pub.error) throw new Error(`IG photo publish: ${pub.error.message}`);
    return pub.id;
  }

  throw new Error("Instagram requires at least one media URL");
}

// ─── Helper: Publish to Facebook ─────────────────────────────────────────────
async function publishToFacebook(opts: {
  pageId: string;
  token: string;
  caption: string;
  mediaUrl?: string;
  contentType: string;
}): Promise<string> {
  const { pageId, token, caption, mediaUrl, contentType } = opts;
  const base = `https://graph.facebook.com/v21.0`;

  if ((contentType === "video" || contentType === "reel") && mediaUrl) {
    const r = await fetch(`${base}/${pageId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_url: mediaUrl, description: caption, access_token: token }),
    });
    const d = await r.json();
    if (d.error) throw new Error(`FB video: ${d.error.message}`);
    return d.id;
  }

  if (mediaUrl) {
    const r = await fetch(`${base}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: mediaUrl, caption, access_token: token }),
    });
    const d = await r.json();
    if (d.error) throw new Error(`FB photo: ${d.error.message}`);
    return d.post_id || d.id;
  }

  // Text-only post
  const r = await fetch(`${base}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: caption, access_token: token }),
  });
  const d = await r.json();
  if (d.error) throw new Error(`FB post: ${d.error.message}`);
  return d.id;
}

export default router;
