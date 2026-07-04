import "dotenv/config";  // load .env file for local dev (no-op in production)
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
import messagingRouter from "./routes/messaging";

// ─── Compliance Pipeline Services ─────────────────────────────────────────────
import { processMessageQueue, recoverStaleMessages } from "./services/send-queue";
import { cleanupExpiredRateLimits } from "./services/rate-limiter";

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

// ─── API Docs (dev reference) ─────────────────
app.get("/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ContentEngineer API Docs</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f0f0f;color:#e2e8f0;min-height:100vh;padding:32px 16px}
  .container{max-width:900px;margin:0 auto}
  h1{font-size:28px;font-weight:700;color:#f59e0b;margin-bottom:4px}
  .subtitle{color:#94a3b8;font-size:14px;margin-bottom:32px}
  .section{margin-bottom:32px}
  .section-title{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #1e293b}
  .route{background:#161b27;border:1px solid #1e293b;border-radius:10px;margin-bottom:10px;overflow:hidden}
  .route-header{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer}
  .method{font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;min-width:52px;text-align:center}
  .get{background:#064e3b;color:#34d399}.post{background:#1e3a5f;color:#60a5fa}
  .delete{background:#450a0a;color:#f87171}.patch{background:#3b1f64;color:#c084fc}
  .path{font-family:'Courier New',monospace;font-size:14px;color:#e2e8f0}
  .desc{margin-left:auto;font-size:12px;color:#64748b;text-align:right}
  .auth-badge{font-size:10px;background:#292524;color:#a3a3a3;padding:2px 7px;border-radius:99px;margin-left:8px;white-space:nowrap}
  .auth-badge.bearer{background:#1c1917;color:#f59e0b}
  .body-example{background:#0a0a0a;border-top:1px solid #1e293b;padding:12px 16px;font-family:'Courier New',monospace;font-size:12px;color:#86efac;white-space:pre}
  .tag{display:inline-block;font-size:10px;background:#1e293b;color:#94a3b8;padding:2px 7px;border-radius:4px;margin-right:4px}
  .env-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .env-item{background:#161b27;border:1px solid #1e293b;border-radius:8px;padding:10px 14px}
  .env-key{font-family:monospace;font-size:12px;color:#f59e0b;margin-bottom:2px}
  .env-val{font-size:11px;color:#64748b}
  .status{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
  .ok{background:#22c55e}.warn{background:#f59e0b}.err{background:#ef4444}
  @media(max-width:600px){.desc{display:none}.env-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="container">
  <h1>⚡ ContentEngineer API</h1>
  <p class="subtitle">Backend v2.0 · Port ${PORT} · <span class="status ok"></span>Running · ${new Date().toLocaleString("en-IN", {timeZone:"Asia/Kolkata"})}</p>

  <div class="section">
    <div class="section-title">🔐 Authentication</div>
    <div class="route">
      <div class="route-header">
        <span class="method get">GET</span>
        <span class="path">/health</span>
        <span class="auth-badge">No auth</span>
        <span class="desc">Health check</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">🔑 API Keys — /api/keys</div>
    <div class="route">
      <div class="route-header">
        <span class="method get">GET</span>
        <span class="path">/api/keys</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">List saved providers</span>
      </div>
    </div>
    <div class="route">
      <div class="route-header">
        <span class="method post">POST</span>
        <span class="path">/api/keys</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">Save/update key</span>
      </div>
      <div class="body-example">{ "provider": "gemini", "key": "AIza...", "label": "My Gemini Key" }</div>
    </div>
    <div class="route">
      <div class="route-header">
        <span class="method post">POST</span>
        <span class="path">/api/keys/:provider/test</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">Test saved key</span>
      </div>
    </div>
    <div class="route">
      <div class="route-header">
        <span class="method delete">DEL</span>
        <span class="path">/api/keys/:provider</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">Delete key</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">🤖 Analysis — /api/analyze</div>
    <div class="route">
      <div class="route-header">
        <span class="method post">POST</span>
        <span class="path">/api/analyze/audit</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">Profile audit</span>
      </div>
      <div class="body-example">{ "profileUrl": "@virat.kohli", "platform": "instagram", "niche": "Sports", "language": "hi" }</div>
    </div>
    <div class="route">
      <div class="route-header">
        <span class="method post">POST</span>
        <span class="path">/api/analyze/competitors</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">Competitor analysis</span>
      </div>
      <div class="body-example">{ "profileUrl": "@virat.kohli", "platform": "instagram", "niche": "Sports", "competitors": ["@rohitsharma45"] }</div>
    </div>
    <div class="route">
      <div class="route-header">
        <span class="method post">POST</span>
        <span class="path">/api/analyze/hashtags</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">Hashtag research</span>
      </div>
      <div class="body-example">{ "niche": "Fitness", "platform": "instagram", "language": "hi" }</div>
    </div>
    <div class="route">
      <div class="route-header">
        <span class="method post">POST</span>
        <span class="path">/api/analyze/ideas</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">Content ideas</span>
      </div>
      <div class="body-example">{ "niche": "Tech", "platform": "instagram", "language": "hi" }</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">💡 Insights — /api/insights</div>
    <div class="route">
      <div class="route-header">
        <span class="method get">GET</span>
        <span class="path">/api/insights</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">Get saved analysis results</span>
      </div>
    </div>
    <div class="route">
      <div class="route-header">
        <span class="method get">GET</span>
        <span class="path">/api/insights/:id</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">Single result by ID</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">💰 Credits — /api/credits</div>
    <div class="route">
      <div class="route-header">
        <span class="method get">GET</span>
        <span class="path">/api/credits</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">Get credit balance</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">🤖 Automation — /api/automation</div>
    <div class="route">
      <div class="route-header">
        <span class="method get">GET</span>
        <span class="path">/api/automation/dms</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">List DM automations</span>
      </div>
    </div>
    <div class="route">
      <div class="route-header">
        <span class="method post">POST</span>
        <span class="path">/api/automation/dms</span>
        <span class="auth-badge bearer">Bearer JWT</span>
        <span class="desc">Create DM automation</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">🔧 Internal Triggers (Worker Secret)</div>
    <div class="route">
      <div class="route-header">
        <span class="method post">POST</span>
        <span class="path">/trigger/publish</span>
        <span class="auth-badge">x-worker-secret</span>
        <span class="desc">Publish scheduled posts</span>
      </div>
    </div>
    <div class="route">
      <div class="route-header">
        <span class="method post">POST</span>
        <span class="path">/trigger/refresh-tokens</span>
        <span class="auth-badge">x-worker-secret</span>
        <span class="desc">Refresh OAuth tokens</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">🌐 Environment Status</div>
    <div class="env-grid">
      <div class="env-item"><div class="env-key">GEMINI_API_KEY</div><div class="env-val">${process.env.GEMINI_API_KEY ? "✅ Set (" + process.env.GEMINI_API_KEY.substring(0,8) + "...)" : "❌ Not set"}</div></div>
      <div class="env-item"><div class="env-key">ANTHROPIC_API_KEY</div><div class="env-val">${process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "your-anthropic-api-key" ? "✅ Set" : "❌ Not set"}</div></div>
      <div class="env-item"><div class="env-key">AWS_ACCESS_KEY_ID</div><div class="env-val">${process.env.AWS_ACCESS_KEY_ID ? "✅ Set (" + process.env.AWS_ACCESS_KEY_ID.substring(0,8) + "...)" : "⚠️ Not set (using bearer token)"}</div></div>
      <div class="env-item"><div class="env-key">AWS_BEARER_TOKEN_BEDROCK</div><div class="env-val">${process.env.AWS_BEARER_TOKEN_BEDROCK ? "✅ Set" : "❌ Not set"}</div></div>
      <div class="env-item"><div class="env-key">OLLAMA_MODEL</div><div class="env-val">${process.env.OLLAMA_MODEL || "llama3.1:8b (default)"} @ ${process.env.OLLAMA_BASE_URL || "localhost:11434"}</div></div>
      <div class="env-item"><div class="env-key">APIFY_TOKEN</div><div class="env-val">${process.env.APIFY_TOKEN ? "✅ Set" : "❌ Not set"}</div></div>
      <div class="env-item"><div class="env-key">SUPABASE</div><div class="env-val">${process.env.SUPABASE_URL ? "✅ Connected" : "❌ Not set"}</div></div>
      <div class="env-item"><div class="env-key">NODE_ENV</div><div class="env-val">${process.env.NODE_ENV || "development"}</div></div>
    </div>
  </div>

  <p style="color:#334155;font-size:12px;text-align:center;margin-top:32px">ContentEngineer Backend · Add <code style="color:#475569">Authorization: Bearer &lt;supabase_jwt&gt;</code> to all protected routes</p>
</div>
</body>
</html>`);
});

// ─── API Routes ───────────────────────────────
app.use("/api/keys", keysRouter);
app.use("/api/credits", creditsRouter);
app.use("/api/analyze", analyzeRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/automation", automationRouter);
app.use("/api/messaging", messagingRouter);

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
// CRON 4: Process outbound message queue every 5 seconds
// This is the ONLY code path that sends messages to Meta API.
// ─────────────────────────────────────────────
cron.schedule("*/5 * * * * *", async () => {
  try {
    const sent = await processMessageQueue();
    if (sent > 0) console.log(`[${new Date().toISOString()}] SendQueue: processed ${sent} messages`);
  } catch (err: any) {
    console.error(`[SendQueue] Cron error: ${err.message}`);
  }
});

// ─────────────────────────────────────────────
// CRON 5: Recover stale messages (stuck in 'processing') every 60 seconds
// ─────────────────────────────────────────────
cron.schedule("* * * * *", async () => {
  try {
    await recoverStaleMessages();
  } catch (err: any) {
    console.error(`[SendQueue] Stale recovery error: ${err.message}`);
  }
});

// ─────────────────────────────────────────────
// CRON 6: Cleanup expired rate limit windows every hour
// ─────────────────────────────────────────────
cron.schedule("0 * * * *", async () => {
  try {
    const cleaned = await cleanupExpiredRateLimits();
    if (cleaned > 0) console.log(`[${new Date().toISOString()}] RateLimiter: cleaned ${cleaned} expired windows`);
  } catch (err: any) {
    console.error(`[RateLimiter] Cleanup error: ${err.message}`);
  }
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
      
      // Cleanup: Delete the raw big files from Supabase if no other scheduled post needs them
      if (post.media_url || (post.media_urls && post.media_urls.length > 0)) {
        const urlsToCheck = post.media_urls || [post.media_url];
        
        for (const url of urlsToCheck) {
          if (!url) continue;
          
          const { count } = await supabase
            .from("scheduled_posts")
            .select("*", { count: "exact", head: true })
            .neq("id", post.id)
            .in("status", ["scheduled", "publishing"])
            .or(`media_url.eq.${url},media_urls.cs.{${url}}`);
            
          if (count === 0) {
            try {
              const urlObj = new URL(url);
              const pathParts = urlObj.pathname.split('/post-media/');
              if (pathParts.length > 1) {
                const pathToDelete = decodeURIComponent(pathParts[1]);
                await supabase.storage.from("post-media").remove([pathToDelete]);
              }
            } catch (e) {
              console.error("Failed to parse and delete media URL", e);
            }
          }
        }
      }
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
// Core: Process unhandled webhook events (with DM automation + dedup)
// Now uses the send queue pipeline instead of direct Meta API calls.
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
      // Handle comment events for DM automation
      if (event.event_type === "instagram_comment" || event.event_type === "facebook_comment") {
        await handleCommentDMTrigger(event);
      }

      await supabase.from("webhook_events").update({
        processed: true,
        processed_at: new Date().toISOString(),
      }).eq("id", event.id);
    } catch (err: any) {
      console.error(`Failed to process webhook event ${event.id}:`, err.message);
      // Still mark as processed to avoid infinite retry loop
      await supabase.from("webhook_events").update({
        processed: true,
        processed_at: new Date().toISOString(),
        processing_error: err.message.substring(0, 500),
      }).eq("id", event.id);
    }
  }
}

// ─────────────────────────────────────────────
// DM Automation: comment trigger → Send Queue (with dedup)
// REFACTORED: Uses enqueueMessage() instead of direct Meta API calls.
// Every message goes through: Compliance → Rate Limiter → Send Queue → Meta API
// ─────────────────────────────────────────────
import { enqueueMessage } from "./services/send-queue";

// Word-boundary keyword matching (prevents "test5" matching "test55")
function keywordMatch(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

async function handleCommentDMTrigger(event: any): Promise<void> {
  const payload = event.event_data || {};
  const commentId: string = payload.comment_id || payload.id;
  const commentText: string = (payload.text || payload.message || "").toLowerCase();
  const senderId: string = payload.from?.id || payload.sender_id;
  const pageId: string = payload.page_id || payload.recipient_id;

  if (!commentId || !senderId || !pageId) return;

  // Find matching automation rules (consolidated — uses automation_rules table)
  const { data: account } = await supabase
    .from("connected_accounts")
    .select("id, user_id")
    .eq("platform_user_id", pageId)
    .eq("is_active", true)
    .maybeSingle();

  if (!account) return;

  const { data: rules } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("account_id", account.id)
    .in("type", ["comment_to_dm"])
    .eq("is_active", true);

  if (!rules?.length) return;

  for (const rule of rules) {
    // Check if keyword matches
    const keywords: string[] = (rule.trigger_config?.keywords || []).map((k: string) => k.toLowerCase());
    const matchType: string = rule.trigger_config?.match_type || "any";
    const matched = keywords.length === 0
      || (matchType === "all"
        ? keywords.every(kw => keywordMatch(commentText, kw))
        : keywords.some(kw => keywordMatch(commentText, kw)));
    if (!matched) continue;

    // DEDUP: Check if we already processed this comment for this rule
    const { data: existing } = await supabase
      .from("dm_trigger_log")
      .select("id")
      .eq("automation_id", rule.id)
      .eq("comment_id", commentId)
      .eq("sender_id", senderId)
      .maybeSingle();

    if (existing) {
      console.log(`[DM] Skipping duplicate trigger: rule=${rule.id} comment=${commentId}`);
      continue;
    }

    // Log FIRST (optimistic) — prevents race condition if cron fires twice
    const { error: logError } = await supabase.from("dm_trigger_log").insert({
      automation_id: rule.id,
      comment_id: commentId,
      sender_id: senderId,
      page_id: pageId,
      triggered_at: new Date().toISOString(),
      status: "queued",
    });
    if (logError) {
      console.log(`[DM] Dedup block (insert conflict): ${logError.message}`);
      continue;
    }

    try {
      // ── ENQUEUE via compliance pipeline (replaces direct Meta API call) ──
      const messageText = rule.action_config?.message || rule.action_config?.reply_text || "Namaste! 🙏";

      const result = await enqueueMessage({
        accountId: account.id,
        userId: account.user_id,
        recipientId: commentId,          // comment_id — NOT sender IG ID
        messagePayload: {
          text: messageText,
          link: rule.action_config?.link || undefined,
        },
        messageType: "private_reply",    // Uses recipient: { comment_id } — works without App Review
        automationRuleId: rule.id,
      });

      if (result.blocked) {
        console.log(`[DM] Blocked by compliance: ${result.blockReason}`);
        await supabase.from("dm_trigger_log").update({
          status: "blocked",
          error: result.blockReason?.substring(0, 500),
        }).eq("automation_id", rule.id).eq("comment_id", commentId);
      } else if (result.queued) {
        console.log(`[DM] Enqueued for ${senderId} via rule ${rule.name} (queue=${result.queueId})`);
        await supabase.from("dm_trigger_log").update({
          status: "queued",
        }).eq("automation_id", rule.id).eq("comment_id", commentId);

        // Increment trigger count
        await supabase.from("automation_rules").update({
          trigger_count: (rule.trigger_count || 0) + 1,
          last_triggered: new Date().toISOString(),
        }).eq("id", rule.id);
      }

    } catch (err: any) {
      console.error(`[DM] Enqueue failed:`, err.message);
      await supabase.from("dm_trigger_log").update({
        status: "failed",
        error: err.message.substring(0, 500),
      }).eq("automation_id", rule.id).eq("comment_id", commentId);
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
  console.log(`📤 Send queue processor: every 5 seconds`);
  console.log(`🛡️ Compliance pipeline: Event → Compliance → Rate Limiter → Send Queue → Meta API`);
  console.log(`💬 DM automation: dedup via dm_trigger_log + compliance layer`);
  console.log(`🌐 API routes: /api/keys /api/credits /api/analyze /api/insights /api/admin`);
});

export default app;
