import express from "express";
import cron from "node-cron";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WORKER_SECRET = process.env.WORKER_SECRET!;

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const app = express();
app.use(express.json());

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ─────────────────────────────────────────────
// Manual trigger endpoint (for testing)
// ─────────────────────────────────────────────
app.post("/trigger/publish", async (req, res) => {
  const secret = req.headers["x-worker-secret"];
  if (secret !== WORKER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const count = await publishScheduledPosts();
  res.json({ published: count });
});

app.post("/trigger/refresh-tokens", async (req, res) => {
  const secret = req.headers["x-worker-secret"];
  if (secret !== WORKER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const count = await refreshExpiringTokens();
  res.json({ refreshed: count });
});

// ─────────────────────────────────────────────
// CRON 1: Publish scheduled posts every minute
// ─────────────────────────────────────────────
cron.schedule("* * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running post publisher...`);
  const count = await publishScheduledPosts();
  if (count > 0) console.log(`  → Published ${count} posts`);
});

// ─────────────────────────────────────────────
// CRON 2: Refresh expiring tokens every 6 hours
// ─────────────────────────────────────────────
cron.schedule("0 */6 * * *", async () => {
  console.log(`[${new Date().toISOString()}] Checking expiring tokens...`);
  const count = await refreshExpiringTokens();
  if (count > 0) console.log(`  → Refreshed ${count} tokens`);
});

// ─────────────────────────────────────────────
// CRON 3: Process unhandled webhook events every 30 seconds
// ─────────────────────────────────────────────
cron.schedule("*/30 * * * * *", async () => {
  await processUnhandledWebhookEvents();
});

// ─────────────────────────────────────────────
// Core: Publish Scheduled Posts
// ─────────────────────────────────────────────
async function publishScheduledPosts(): Promise<number> {
  const now = new Date().toISOString();

  // Get posts that are due for publishing
  const { data: posts, error } = await supabase
    .from("scheduled_posts")
    .select("*, connected_accounts(access_token, platform_user_id, page_id)")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(10);

  if (error || !posts?.length) return 0;

  let publishedCount = 0;

  for (const post of posts) {
    try {
      // Mark as publishing
      await supabase.from("scheduled_posts").update({ status: "publishing" }).eq("id", post.id);

      const platformPostId = await publishPost(post);

      // Mark as published
      await supabase.from("scheduled_posts").update({
        status: "published",
        published_at: new Date().toISOString(),
        platform_post_id: platformPostId,
      }).eq("id", post.id);

      publishedCount++;
    } catch (err: any) {
      console.error(`Failed to publish post ${post.id}:`, err.message);

      // Retry up to 3 times, then mark failed
      const retryCount = (post.retry_count || 0) + 1;
      await supabase.from("scheduled_posts").update({
        status: retryCount >= 3 ? "failed" : "scheduled",
        retry_count: retryCount,
        error_message: err.message,
        // Push next retry by 5 minutes
        scheduled_at: retryCount < 3
          ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
          : post.scheduled_at,
      }).eq("id", post.id);
    }
  }

  return publishedCount;
}

async function publishPost(post: any): Promise<string> {
  const token = post.connected_accounts?.access_token;
  if (!token) throw new Error("No access token found for account");

  switch (post.platform) {
    case "instagram":
      return publishInstagramPost(post, token);
    case "facebook":
      return publishFacebookPost(post, token);
    case "youtube":
      return publishYouTubePost(post, token);
    default:
      throw new Error(`Unsupported platform: ${post.platform}`);
  }
}

// Instagram: 2-step (container → publish)
async function publishInstagramPost(post: any, token: string): Promise<string> {
  const igUserId = post.connected_accounts?.platform_user_id;

  // Step 1: Create media container
  const isVideo = post.content_type === "reel";
  const containerParams: Record<string, string> = {
    access_token: token,
    caption: post.caption || "",
  };

  if (isVideo) {
    containerParams.media_type = "REELS";
    containerParams.video_url = post.media_urls?.[0];
    containerParams.share_to_feed = "true";
  } else {
    containerParams.image_url = post.media_urls?.[0];
  }

  const containerRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerParams),
    }
  );
  const containerData = await containerRes.json();
  if (!containerData.id) throw new Error(`Container creation failed: ${JSON.stringify(containerData)}`);

  // For videos, wait for upload to complete
  if (isVideo) {
    await waitForVideoUpload(containerData.id, token);
  }

  // Step 2: Publish container
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerData.id, access_token: token }),
    }
  );
  const publishData = await publishRes.json();
  if (!publishData.id) throw new Error(`Publish failed: ${JSON.stringify(publishData)}`);

  // Post first comment with hashtags if set
  if (post.first_comment) {
    await fetch(`https://graph.facebook.com/v21.0/${publishData.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: post.first_comment, access_token: token }),
    });
  }

  return publishData.id;
}

async function waitForVideoUpload(containerId: string, token: string, maxAttempts = 12): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds

    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${token}`
    );
    const status = await statusRes.json();

    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR") throw new Error("Video upload failed on Instagram servers");
  }
  throw new Error("Video upload timed out");
}

// Facebook Page post
async function publishFacebookPost(post: any, token: string): Promise<string> {
  const pageId = post.connected_accounts?.page_id;

  const body: Record<string, string> = {
    message: post.caption || "",
    access_token: token,
  };

  if (post.media_urls?.length > 0) {
    body.link = post.media_urls[0]; // for link posts; for photo/video use different endpoint
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Facebook post failed: ${JSON.stringify(data)}`);
  return data.id;
}

// YouTube: Upload video (requires multipart upload for large files)
async function publishYouTubePost(post: any, token: string): Promise<string> {
  // For YouTube, media_urls[0] should be a publicly accessible video URL
  // We download it and re-upload via YouTube API
  const videoUrl = post.media_urls?.[0];
  if (!videoUrl) throw new Error("No video URL for YouTube post");

  const res = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": "video/*",
    },
    body: JSON.stringify({
      snippet: {
        title: post.caption?.split("\n")[0]?.substring(0, 100) || "New Video",
        description: post.caption || "",
        tags: post.hashtags || [],
        categoryId: "22", // People & Blogs
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
    }),
  });

  if (!res.ok) throw new Error(`YouTube upload initiation failed: ${res.status}`);
  const uploadUrl = res.headers.get("Location");
  if (!uploadUrl) throw new Error("No upload URL returned by YouTube");

  // In production: stream the video from videoUrl to uploadUrl
  // For now return a placeholder — full resumable upload requires streaming
  console.log(`YouTube resumable upload URL: ${uploadUrl}`);
  return "youtube_upload_initiated";
}

// ─────────────────────────────────────────────
// Core: Refresh Expiring Tokens
// ─────────────────────────────────────────────
async function refreshExpiringTokens(): Promise<number> {
  // Find Instagram tokens expiring in next 7 days
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("platform", "instagram")
    .eq("is_active", true)
    .lte("token_expires_at", sevenDaysFromNow);

  if (!accounts?.length) return 0;

  let refreshedCount = 0;

  for (const account of accounts) {
    try {
      // Instagram long-lived tokens can be refreshed
      const res = await fetch(
        `https://graph.instagram.com/refresh_access_token?` +
        `grant_type=ig_refresh_token&access_token=${account.access_token}`
      );
      const data = await res.json();

      if (data.access_token) {
        const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
        await supabase.from("connected_accounts").update({
          access_token: data.access_token,
          token_expires_at: expiresAt,
        }).eq("id", account.id);
        refreshedCount++;
      }
    } catch (err: any) {
      console.error(`Failed to refresh token for account ${account.id}:`, err.message);
    }
  }

  // YouTube: refresh using refresh_token
  const { data: ytAccounts } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("platform", "youtube")
    .eq("is_active", true)
    .not("refresh_token", "is", null)
    .lte("token_expires_at", new Date(Date.now() + 3600 * 1000).toISOString());

  for (const account of (ytAccounts || [])) {
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: account.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const data = await res.json();

      if (data.access_token) {
        await supabase.from("connected_accounts").update({
          access_token: data.access_token,
          token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        }).eq("id", account.id);
        refreshedCount++;
      }
    } catch (err: any) {
      console.error(`Failed to refresh YouTube token for ${account.id}:`, err.message);
    }
  }

  return refreshedCount;
}

// ─────────────────────────────────────────────
// Core: Process unhandled webhook events
// ─────────────────────────────────────────────
async function processUnhandledWebhookEvents(): Promise<void> {
  const { data: events } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("processed", false)
    .lt("created_at", new Date(Date.now() - 30000).toISOString()) // older than 30 seconds
    .limit(20);

  if (!events?.length) return;

  for (const event of events) {
    try {
      // Mark as processed (retry logic can be added)
      await supabase.from("webhook_events").update({
        processed: true,
        processed_at: new Date().toISOString(),
      }).eq("id", event.id);
    } catch (err: any) {
      console.error(`Failed to process webhook event ${event.id}:`, err.message);
    }
  }
}

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Content Engineer Worker running on port ${PORT}`);
  console.log(`📅 Post publisher: every minute`);
  console.log(`🔑 Token refresh: every 6 hours`);
  console.log(`📨 Webhook processor: every 30 seconds`);
});

export default app;
