import express from "express";
import cron from "node-cron";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { corsMiddleware } from "./middleware/cors";
import keysRouter from "./routes/keys";
import creditsRouter from "./routes/credits";
import analyzeRouter from "./routes/analyze";
import insightsRouter from "./routes/insights";
import adminRouter from "./routes/admin";
import automationRouter from "./routes/automation";

// ─────────────────────────────────────────────
// Config validation
// ─────────────────────────────────────────────
const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WORKER_SECRET",
  "API_KEY_SECRET",
];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 3001;
const WORKER_SECRET = process.env.WORKER_SECRET!;

const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────
// Express app
// ─────────────────────────────────────────────
const app = express();
app.use(corsMiddleware);
app.use(express.json({ limit: "10mb" }));

// ─── Health check (no auth required) ─────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────
app.use("/api/keys", keysRouter);
app.use("/api/credits", creditsRouter);
app.use("/api/analyze", analyzeRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/automation", automationRouter);

// ─── Worker trigger endpoints (internal — protected by WORKER_SECRET) ─────────
function requireWorkerSecret(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (req.headers["x-worker-secret"] !== WORKER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.post("/trigger/publish", requireWorkerSecret, async (_req, res) => {
  const count = await publishScheduledPosts();
  res.json({ published: count });
});

app.post("/trigger/refresh-tokens", requireWorkerSecret, async (_req, res) => {
  const count = await refreshExpiringTokens();
  res.json({ refreshed: count });
});

// ─────────────────────────────────────────────
// CRON 1: Publish scheduled posts every minute
// ─────────────────────────────────────────────
cron.schedule("* * * * *", async () => {
  const count = await publishScheduledPosts();
  if (count > 0) console.log(`[${new Date().toISOString()}] Published ${count} posts`);
});

// ─────────────────────────────────────────────
// CRON 2: Refresh expiring tokens every 6 hours
// ─────────────────────────────────────────────
cron.schedule("0 */6 * * *", async () => {
  const count = await refreshExpiringTokens();
  if (count > 0) console.log(`[${new Date().toISOString()}] Refreshed ${count} tokens`);
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
      await supabase.from("scheduled_posts").update({ status: "publishing" }).eq("id", post.id);

      const platformPostId = await publishPost(post);

      await supabase.from("scheduled_posts").update({
        status: "published",
        published_at: new Date().toISOString(),
        platform_post_id: platformPostId,
      }).eq("id", post.id);

      publishedCount++;
    } catch (err: any) {
      console.error(`Failed to publish post ${post.id}:`, err.message);
      const retryCount = (post.retry_count || 0) + 1;
      await supabase.from("scheduled_posts").update({
        status: retryCount >= 3 ? "failed" : "scheduled",
        retry_count: retryCount,
        error_message: err.message,
        scheduled_at:
          retryCount < 3
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
    default:
      throw new Error(`Unsupported platform: ${post.platform}`);
  }
}

async function publishInstagramPost(post: any, token: string): Promise<string> {
  const igUserId = post.connected_accounts?.platform_user_id;

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
  if (!containerData.id)
    throw new Error(`Container creation failed: ${JSON.stringify(containerData)}`);

  if (isVideo) {
    await waitForVideoUpload(containerData.id, token);
  }

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

  if (post.first_comment) {
    await fetch(`https://graph.facebook.com/v21.0/${publishData.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: post.first_comment, access_token: token }),
    });
  }

  return publishData.id;
}

async function waitForVideoUpload(
  containerId: string,
  token: string,
  maxAttempts = 12
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${token}`
    );
    const status = await statusRes.json();
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR") throw new Error("Video upload failed on Instagram servers");
  }
  throw new Error("Video upload timed out");
}

async function publishFacebookPost(post: any, token: string): Promise<string> {
  const pageId = post.connected_accounts?.page_id;

  const body: Record<string, string> = {
    message: post.caption || "",
    access_token: token,
  };

  if (post.media_urls?.length > 0) {
    body.link = post.media_urls[0];
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

// ─────────────────────────────────────────────
// Core: Refresh Expiring Tokens
// ─────────────────────────────────────────────
async function refreshExpiringTokens(): Promise<number> {
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
      const res = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${account.access_token}`
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

  const { data: ytAccounts } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("platform", "youtube")
    .eq("is_active", true)
    .not("refresh_token", "is", null)
    .lte("token_expires_at", new Date(Date.now() + 3600 * 1000).toISOString());

  for (const account of ytAccounts || []) {
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
    .lt("created_at", new Date(Date.now() - 30000).toISOString())
    .limit(20);

  if (!events?.length) return;

  for (const event of events) {
    try {
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
  console.log(`🚀 Content Engineer Backend running on port ${PORT}`);
  console.log(`📅 Post publisher: every minute`);
  console.log(`🔑 Token refresh: every 6 hours`);
  console.log(`📨 Webhook processor: every 30 seconds`);
  console.log(`🌐 API routes: /api/keys /api/credits /api/analyze /api/insights /api/admin`);
});

export default app;
