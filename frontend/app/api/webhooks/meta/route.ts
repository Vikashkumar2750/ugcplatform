import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN!;
const META_APP_SECRET = process.env.META_APP_SECRET!;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─────────────────────────────────────────────────────────────
// GET — Meta webhook verification
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Webhook] Meta verified ✓");
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ─────────────────────────────────────────────────────────────
// POST — Receive Meta webhook events
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256") || "";

    if (!verifySignature(rawBody, signature)) {
      console.warn("[Webhook] Signature mismatch");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const supabase = getServiceClient();

    console.log("[Webhook] Received:", JSON.stringify(body).substring(0, 500));

    for (const entry of (body.entry || [])) {
      const pageId: string = entry.id;

      // ── Standard change events (comments, mentions, follow) ──
      for (const change of (entry.changes || [])) {
        await processChangeEvent(supabase, {
          object: body.object,
          field: change.field,
          value: change.value,
          pageId,
        });
      }

      // ── Messaging events (DMs) ──────────────────────────────
      for (const msg of (entry.messaging || [])) {
        await processMessagingEvent(supabase, msg, pageId);
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("[Webhook] Error:", err);
    return new NextResponse("OK", { status: 200 }); // Always 200 to Meta
  }
}

// ─────────────────────────────────────────────────────────────
// Change events dispatcher
// ─────────────────────────────────────────────────────────────
async function processChangeEvent(
  supabase: any,
  ctx: { object: string; field: string; value: any; pageId: string }
) {
  const { field, value, pageId } = ctx;
  console.log(`[Webhook] Change event: field=${field} pageId=${pageId}`);

  // Log to DB
  await supabase.from("webhook_events").insert({
    platform: ctx.object,
    event_type: field,
    sender_id: value?.from?.id || null,
    recipient_id: pageId,
    payload: value,
    processed: false,
  }).select().single();

  if (field === "comments") {
    await processCommentEvent(supabase, value, pageId);
  }
  if (field === "mentions") {
    console.log("[Webhook] Mention event:", JSON.stringify(value).substring(0, 200));
  }
  // Note: Instagram doesn't send individual follow events via webhooks.
  // New-follower DM is handled in processMessagingEvent via first-contact detection.
}

// ─────────────────────────────────────────────────────────────
// DM / Messaging events
// ─────────────────────────────────────────────────────────────
async function processMessagingEvent(supabase: any, messaging: any, pageId: string) {
  // Skip delivery receipts, reads etc.
  if (!messaging.message && !messaging.follow) return;

  const senderId: string = messaging.sender?.id;
  const messageText: string = messaging.message?.text?.toLowerCase() || "";

  console.log(`[Webhook] DM from ${senderId} to page ${pageId}: "${messageText.substring(0, 80)}"`);

  // Log DM event
  await supabase.from("webhook_events").insert({
    platform: "instagram",
    event_type: "message",
    sender_id: senderId,
    recipient_id: pageId,
    payload: messaging,
    processed: false,
  });

  // Find connected account for this page/IG account
  const { data: account } = await supabase
    .from("connected_accounts")
    .select("id, user_id, access_token, platform_user_id")
    .or(`platform_user_id.eq.${pageId},page_id.eq.${pageId}`)
    .eq("is_active", true)
    .single();

  if (!account) {
    console.warn(`[Webhook] No connected account found for pageId=${pageId}`);
    return;
  }

  // Check opt-out
  const { data: conv } = await supabase
    .from("dm_conversations")
    .select("opted_out, message_count")
    .eq("account_id", account.id)
    .eq("sender_id", senderId)
    .single();

  if (conv?.opted_out) {
    console.log(`[Webhook] Sender ${senderId} opted out — skipping`);
    return;
  }

  const isFirstMessage = !conv || (conv.message_count || 0) === 0;

  // Update or create conversation tracker (avoid upsert conflict issue)
  if (conv) {
    await supabase.from("dm_conversations")
      .update({
        message_count: (conv.message_count || 0) + 1,
        last_message_at: new Date().toISOString(),
      })
      .eq("account_id", account.id)
      .eq("sender_id", senderId);
  } else {
    const { error: insertErr } = await supabase.from("dm_conversations").insert({
      account_id: account.id,
      user_id: account.user_id,
      sender_id: senderId,
      message_count: 1,
      last_message_at: new Date().toISOString(),
    });
    if (insertErr) console.warn("[Webhook] dm_conversations insert error:", insertErr.message);
  }

  // Handle opt-out keywords
  const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "optout", "opt out", "cancel", "band karo"];
  if (OPT_OUT_KEYWORDS.some(k => messageText.includes(k))) {
    await supabase.from("dm_conversations").upsert({
      account_id: account.id,
      user_id: account.user_id,
      sender_id: senderId,
      opted_out: true,
    }, { onConflict: "account_id,sender_id" });
    console.log(`[Webhook] Opt-out recorded for ${senderId}`);
    return;
  }

  // ── 1. dm_new_follower: fires on FIRST message ──────────────
  // Instagram doesn't send follow webhooks — we detect "new follower"
  // as the first time they message us (most common scenario).
  if (isFirstMessage) {
    const { data: followerRules } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("account_id", account.id)
      .eq("type", "dm_new_follower")
      .eq("is_active", true)
      .limit(1);

    if (followerRules?.length > 0) {
      const rule = followerRules[0];
      console.log(`[Webhook] Triggering dm_new_follower rule: ${rule.name}`);
      await sendInstagramDM(account.access_token, senderId, rule.action_config, account.platform_user_id);
      await supabase.from("automation_rules").update({
        trigger_count: (rule.trigger_count || 0) + 1,
        last_triggered: new Date().toISOString(),
      }).eq("id", rule.id);
      return; // Don't also trigger keyword rules on first message
    }
  }

  // ── 2. dm_keyword: fires when message matches keywords ───────
  const { data: keywordRules } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("account_id", account.id)
    .eq("type", "dm_keyword")
    .eq("is_active", true);

  for (const rule of (keywordRules || [])) {
    const keywords: string[] = rule.trigger_config?.keywords || [];
    const matchType: string = rule.trigger_config?.match_type || "any";

    if (keywords.length === 0) continue; // Skip rules with no keywords

    const matched = matchType === "all"
      ? keywords.every(k => messageText.includes(k.toLowerCase()))
      : keywords.some(k => messageText.includes(k.toLowerCase()));

    if (matched) {
      console.log(`[Webhook] Keyword match — rule: ${rule.name}`);
      await sendInstagramDM(account.access_token, senderId, rule.action_config, account.platform_user_id);
      await supabase.from("automation_rules").update({
        trigger_count: (rule.trigger_count || 0) + 1,
        last_triggered: new Date().toISOString(),
      }).eq("id", rule.id);
      break; // First matching rule only
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Comment events
// ─────────────────────────────────────────────────────────────
async function processCommentEvent(supabase: any, payload: any, pageId: string) {
  const commentText = payload?.text?.toLowerCase() || "";
  const commentId = payload?.id;
  const mediaId = payload?.media?.id;
  const commentorId = payload?.from?.id;

  console.log(`[Webhook] Comment: "${commentText.substring(0, 60)}" on media ${mediaId} by ${commentorId}`);

  if (!commentId) {
    console.warn("[Webhook] Comment has no ID — skipping");
    return;
  }

  // ── Atomic Dedup: Mark comment as "being processed" FIRST ──────────────────
  // Using a dedicated table with UNIQUE(comment_id, rule_id) to prevent
  // duplicate processing even when Meta sends the webhook multiple times.
  // We insert BEFORE acting — if duplicate, the insert fails → skip.

  // Get all active comment rules
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("*, connected_accounts(access_token, platform_user_id)")
    .in("type", ["comment_reply", "comment_to_dm", "hide_comment"])
    .eq("is_active", true);

  for (const rule of (rules || [])) {
    // Media filter
    const ruleMediaId = rule.trigger_config?.media_id;
    if (ruleMediaId && ruleMediaId !== mediaId) continue;

    // Keyword match
    const keywords: string[] = rule.trigger_config?.keywords || [];
    const matchType: string = rule.trigger_config?.match_type || "any";
    const matched = keywords.length === 0
      ? true
      : matchType === "all"
        ? keywords.every(k => commentText.includes(k.toLowerCase()))
        : keywords.some(k => commentText.includes(k.toLowerCase()));

    if (!matched) continue;

    // ── ATOMIC DEDUP: try to insert a processed_comment record ────────────────
    // UNIQUE constraint on (comment_id, rule_id) — duplicate insert will fail
    const { error: dedupError } = await supabase
      .from("processed_comments")
      .insert({
        comment_id: commentId,
        rule_id: rule.id,
        commentor_id: commentorId || null,
        media_id: mediaId || null,
        processed_at: new Date().toISOString(),
      });

    if (dedupError) {
      // Unique violation = already processed
      if (dedupError.code === "23505") {
        console.log(`[Webhook] Comment ${commentId} already processed for rule ${rule.name} — skipping`);
        continue;
      }
      console.warn(`[Webhook] Dedup insert error: ${dedupError.message}`);
      // Don't skip on other errors — still try to process
    }

    // Get token — from joined connected_accounts
    let token = rule.connected_accounts?.access_token;
    let igId = rule.connected_accounts?.platform_user_id;

    if (!token && rule.account_id) {
      const { data: acc } = await supabase
        .from("connected_accounts")
        .select("access_token, platform_user_id")
        .eq("id", rule.account_id)
        .single();
      token = acc?.access_token;
      igId = acc?.platform_user_id;
    }

    if (!token) {
      console.warn(`[Webhook] No token for rule ${rule.id}`);
      continue;
    }

    // ── Execute action ────────────────────────────────────────────────────────
    if (rule.type === "comment_reply" && rule.action_config?.reply_text) {
      console.log(`[Webhook] Replying to comment ${commentId}`);
      const replyRes = await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: rule.action_config.reply_text,
          access_token: token,
        }),
      });
      const replyData = await replyRes.json();
      if (!replyRes.ok) console.error(`[Webhook] Reply failed: ${JSON.stringify(replyData)}`);
    }

    if (rule.type === "comment_to_dm" && commentorId) {
      console.log(`[Webhook] Sending DM to commenter ${commentorId}`);
      await sendInstagramDM(token, commentorId, rule.action_config, igId);
    }

    if (rule.type === "hide_comment") {
      console.log(`[Webhook] Hiding comment ${commentId}`);
      await fetch(`https://graph.facebook.com/v21.0/${commentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_hidden: true, access_token: token }),
      });
    }

    // Update trigger count
    await supabase.from("automation_rules").update({
      trigger_count: (rule.trigger_count || 0) + 1,
      last_triggered: new Date().toISOString(),
    }).eq("id", rule.id);
  }
}

// ─────────────────────────────────────────────────────────────
// Send Instagram DM via Graph API
// ─────────────────────────────────────────────────────────────
async function sendInstagramDM(
  accessToken: string,
  recipientId: string,
  actionConfig: any,
  igUserId: string
) {
  const delay = actionConfig?.delay_seconds || 0;
  if (delay > 0) await new Promise(r => setTimeout(r, delay * 1000));

  const messageText = actionConfig?.message || actionConfig?.reply_text || "Namaste! 🙏";

  const body: any = {
    recipient: { id: recipientId },
    message: { text: messageText },
  };

  // Optional: Add link button
  if (actionConfig?.link) {
    body.message.attachment = {
      type: "template",
      payload: {
        template_type: "button",
        text: messageText,
        buttons: [{ type: "web_url", url: actionConfig.link, title: "Check it out →" }],
      },
    };
    delete body.message.text;
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: accessToken }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`[Webhook] DM send failed: ${JSON.stringify(data)}`);
  } else {
    console.log(`[Webhook] DM sent ✓ to ${recipientId}`);
  }
  return data;
}

// ─────────────────────────────────────────────────────────────
// Signature verification
// ─────────────────────────────────────────────────────────────
function verifySignature(body: string, signature: string): boolean {
  // Set META_SKIP_SIGNATURE_CHECK=true in Vercel env to bypass (for testing)
  if (process.env.META_SKIP_SIGNATURE_CHECK === "true") {
    console.log("[Webhook] Signature check SKIPPED (META_SKIP_SIGNATURE_CHECK=true)");
    return true;
  }

  if (!META_APP_SECRET) {
    console.warn("[Webhook] META_APP_SECRET not set — skipping signature check");
    return true;
  }

  if (!signature) {
    console.warn("[Webhook] No signature header received");
    return false;
  }

  try {
    const crypto = require("crypto");
    const expected = "sha256=" +
      crypto.createHmac("sha256", META_APP_SECRET)
        .update(Buffer.from(body, "utf-8"))
        .digest("hex");

    // Timing-safe comparison
    try {
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length) {
        console.warn("[Webhook] Signature length mismatch — check META_APP_SECRET in Vercel env");
        return false;
      }
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      const match = signature === expected;
      if (!match) console.warn("[Webhook] Signature mismatch — verify META_APP_SECRET matches Facebook App Secret");
      return match;
    }
  } catch (e) {
    console.error("[Webhook] Signature error:", e);
    return false;
  }
}
