import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN!;
const META_APP_SECRET = process.env.META_APP_SECRET!;
const BACKEND_URL = process.env.RENDER_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.RENDER_WORKER_SECRET || process.env.WORKER_SECRET || "";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─────────────────────────────────────────────────────────────
// Webhook event deduplication (in-memory, per serverless instance)
// Prevents processing the same event twice if Meta retries.
// ─────────────────────────────────────────────────────────────
const processedEvents = new Set<string>();
const MAX_DEDUP_SIZE = 5000;

function getEventFingerprint(entry: any): string {
  const id = entry.id || "";
  const time = entry.time || "";
  return crypto.createHash("md5").update(`${id}:${time}`).digest("hex");
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
      console.warn("[Webhook] Signature mismatch — rejecting");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const supabase = getServiceClient();

    console.log("[Webhook] Received:", JSON.stringify(body).substring(0, 800));
    console.log("[Webhook] Object:", body.object, "| Entries:", body.entry?.length);

    // ── Log EVERY raw webhook to DB for debugging ──
    try {
      await supabase.from("webhook_raw_log").insert({
        object_type: body.object || "unknown",
        raw_body: body,
        received_at: new Date().toISOString(),
      });
    } catch {
      // Table might not exist yet — that's fine, don't crash
    }

    for (const entry of (body.entry || [])) {
      // ── Deduplication: skip if we've already processed this entry ──
      const fingerprint = getEventFingerprint(entry);
      if (processedEvents.has(fingerprint)) {
        console.log(`[Webhook] Skipping duplicate entry: ${fingerprint}`);
        continue;
      }
      processedEvents.add(fingerprint);
      // Prune dedup set to prevent memory leak
      if (processedEvents.size > MAX_DEDUP_SIZE) {
        const toDelete = [...processedEvents].slice(0, 1000);
        toDelete.forEach(k => processedEvents.delete(k));
      }

      const pageId: string = entry.id;
      console.log(`[Webhook] Processing entry id=${pageId} | changes=${entry.changes?.length || 0} | messaging=${entry.messaging?.length || 0}`);

      // ── Standard change events (comments, mentions, follow) ──
      for (const change of (entry.changes || [])) {
        console.log(`[Webhook] Change: field="${change.field}" value_keys=${Object.keys(change.value || {}).join(",")}`);
        
        await processChangeEvent(supabase, {
          object: body.object,
          field: change.field,
          value: change.value,
          pageId,
        });

        // ── Handle "feed" field which may contain Instagram comments ──
        // When subscribed to Page "feed", comments come as field="feed" with value.item="comment"
        if (change.field === "feed" && change.value?.item === "comment" && change.value?.verb === "add") {
          console.log(`[Webhook] Feed comment detected! Converting to comment event format`);
          const feedComment = {
            id: change.value.comment_id,
            text: change.value.message,
            from: change.value.from,
            media: { id: change.value.post_id },
            parent_id: change.value.parent_id || null,
          };
          await processCommentEvent(supabase, feedComment, pageId);
        }
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
  // CRITICAL: Track last_user_interaction_at for 24h messaging window compliance
  if (conv) {
    await supabase.from("dm_conversations")
      .update({
        message_count: (conv.message_count || 0) + 1,
        last_message_at: new Date().toISOString(),
        last_user_interaction_at: new Date().toISOString(),  // 24h window tracking
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
      last_user_interaction_at: new Date().toISOString(),  // 24h window tracking
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
      await enqueueViaBackend({
        accountId: account.id,
        userId: account.user_id,
        recipientId: senderId,
        messagePayload: {
          text: rule.action_config?.message || "Namaste! 🙏",
          link: rule.action_config?.link || undefined,
        },
        messageType: "dm",
        automationRuleId: rule.id,
      });
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
      await enqueueViaBackend({
        accountId: account.id,
        userId: account.user_id,
        recipientId: senderId,
        messagePayload: {
          text: rule.action_config?.message || rule.action_config?.reply_text || "Namaste! 🙏",
          link: rule.action_config?.link || undefined,
        },
        messageType: "dm",
        automationRuleId: rule.id,
      });
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
  const parentId = payload?.parent_id;

  console.log(`[Webhook] Comment: "${commentText.substring(0, 60)}" on media ${mediaId} by ${commentorId} parent=${parentId} pageId=${pageId}`);

  if (!commentId) {
    console.warn("[Webhook] Comment has no ID — skipping");
    return;
  }

  // ── Skip replies to comments (prevents infinite loop) ──
  if (parentId) {
    console.log(`[Webhook] Skipping reply-to-comment (parent_id=${parentId})`);
    return;
  }

  // ── Find the connected account for this pageId ──────────────────────────
  // This is the MASTER token lookup — used as fallback for any rule without account_id
  const { data: pageAccount } = await supabase
    .from("connected_accounts")
    .select("id, user_id, access_token, platform_user_id")
    .or(`platform_user_id.eq.${pageId},page_id.eq.${pageId}`)
    .eq("is_active", true)
    .maybeSingle();

  console.log(`[Webhook] Page account found: ${pageAccount ? 'YES (id=' + pageAccount.id + ')' : 'NO'}`);

  // Skip if commentor is our own account
  if (pageAccount?.platform_user_id && commentorId === pageAccount.platform_user_id) {
    console.log(`[Webhook] Skipping own account comment`);
    return;
  }

  // ── Get ALL active comment rules ───────────────────────────────────────
  // Query by BOTH account_id match AND rules with null account_id (for this user)
  let rulesQuery = supabase
    .from("automation_rules")
    .select("*")
    .in("type", ["comment_reply", "comment_to_dm", "hide_comment", "comment_automation"])
    .eq("is_active", true);

  // If we found the page account, filter rules for this specific account or user
  if (pageAccount) {
    rulesQuery = rulesQuery.or(`account_id.eq.${pageAccount.id},account_id.is.null`);
    // Also ensure we only get rules from this user (not other users' null account_id rules)
    rulesQuery = rulesQuery.eq("user_id", pageAccount.user_id);
  }

  const { data: rules, error: rulesError } = await rulesQuery;

  if (rulesError) {
    console.error(`[Webhook] Failed to fetch rules: ${rulesError.message}`);
    return;
  }

  console.log(`[Webhook] Found ${(rules || []).length} matching comment rules`);

  if (!rules?.length) {
    console.log("[Webhook] No active comment rules found");
    return;
  }

  for (const rule of rules) {
    // Media filter — skip if rule is for a specific post and this isn't it
    const ruleMediaId = rule.trigger_config?.media_id;
    if (ruleMediaId && ruleMediaId !== mediaId) continue;

    // Keyword match
    const keywords: string[] = rule.trigger_config?.keywords || [];
    const matchType: string = rule.trigger_config?.match_type || "any";
    const matched = keywords.length === 0
      ? true
      : matchType === "all"
        ? keywords.every((k: string) => commentText.includes(k.toLowerCase()))
        : keywords.some((k: string) => commentText.includes(k.toLowerCase()));

    if (!matched) {
      console.log(`[Webhook] Keywords didn't match for rule "${rule.name}"`);
      continue;
    }

    console.log(`[Webhook] ✅ Rule "${rule.name}" matched! Processing...`);

    // ── Dedup: try processed_comments (graceful if table doesn't exist) ───
    let skipDueToDuplicate = false;
    try {
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
        if (dedupError.code === "23505") {
          console.log(`[Webhook] Comment ${commentId} already processed for rule "${rule.name}" — skipping`);
          skipDueToDuplicate = true;
        } else if (dedupError.code === "42P01") {
          // Table doesn't exist — just log and continue (don't block automation!)
          console.warn(`[Webhook] processed_comments table missing — continuing without dedup`);
        } else {
          console.warn(`[Webhook] Dedup insert error (${dedupError.code}): ${dedupError.message} — continuing anyway`);
        }
      }
    } catch (e: any) {
      console.warn(`[Webhook] Dedup check failed: ${e.message} — continuing anyway`);
    }

    if (skipDueToDuplicate) continue;

    // ── Get access token — with FALLBACK to pageAccount ──────────────────
    let token: string | null = null;

    // Try 1: Get from rule's account_id
    if (rule.account_id) {
      const { data: acc } = await supabase
        .from("connected_accounts")
        .select("access_token, platform_user_id")
        .eq("id", rule.account_id)
        .single();
      token = acc?.access_token || null;
    }

    // Try 2: Fallback to pageAccount (found from webhook pageId)
    if (!token && pageAccount?.access_token) {
      token = pageAccount.access_token;
      console.log(`[Webhook] Using pageAccount token as fallback for rule "${rule.name}"`);
    }

    if (!token) {
      console.error(`[Webhook] ❌ No token available for rule "${rule.name}" — cannot execute`);
      continue;
    }

    // ── Determine which actions to run ───────────────────────────────────
    const actionsEnabled = rule.action_config?.actions_enabled;
    const isUnified = rule.type === "comment_automation";
    const shouldReply = isUnified ? actionsEnabled?.reply : rule.type === "comment_reply";
    const shouldDM = isUnified ? actionsEnabled?.dm : rule.type === "comment_to_dm";
    const shouldHide = isUnified ? (actionsEnabled?.hide || rule.action_config?.hide) : rule.type === "hide_comment";

    console.log(`[Webhook] Actions: reply=${shouldReply}, dm=${shouldDM}, hide=${shouldHide}`);

    // ── AUTO-REPLY to comment (public reply) ─────────────────────────────
    if (shouldReply && rule.action_config?.reply_text) {
      try {
        console.log(`[Webhook] Sending public reply to comment ${commentId}`);
        const replyRes = await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: rule.action_config.reply_text,
            access_token: token,
          }),
        });
        const replyData = await replyRes.json();
        if (!replyRes.ok) {
          console.error(`[Webhook] ❌ Reply failed: ${JSON.stringify(replyData)}`);
        } else {
          console.log(`[Webhook] ✅ Comment reply sent successfully`);
        }
      } catch (e: any) {
        console.error(`[Webhook] ❌ Reply error: ${e.message}`);
      }
    }

    // ── SEND DM to commenter ─────────────────────────────────────────────
    if (shouldDM && commentorId) {
      const dmText = rule.action_config?.message || "Namaste! 🙏";
      const dmLink = rule.action_config?.link || undefined;

      console.log(`[Webhook] Sending DM to commenter ${commentorId}`);

      // Try backend worker first
      const enqueueResult = await enqueueViaBackend({
        accountId: rule.account_id || pageAccount?.id,
        userId: rule.user_id,
        recipientId: commentorId,
        messagePayload: { text: dmText, link: dmLink },
        messageType: "dm",
        automationRuleId: rule.id,
      });

      // If backend worker is unreachable, send directly via Meta API
      if (enqueueResult.error && !enqueueResult.queued) {
        console.warn(`[Webhook] Backend enqueue failed — sending DM directly via Meta API`);
        try {
          const dmBody: any = {
            recipient: { id: commentorId },
            message: dmLink
              ? {
                  attachment: {
                    type: "template",
                    payload: {
                      template_type: "generic",
                      elements: [{
                        title: dmText.substring(0, 80),
                        default_action: { type: "web_url", url: dmLink },
                        buttons: [{ type: "web_url", url: dmLink, title: "Open Link →" }],
                      }],
                    },
                  },
                }
              : { text: dmText },
          };

          const dmRes = await fetch(
            `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(dmBody),
            }
          );
          const dmData = await dmRes.json();
          if (!dmRes.ok) {
            console.error(`[Webhook] ❌ Direct DM failed: ${JSON.stringify(dmData)}`);
          } else {
            console.log(`[Webhook] ✅ DM sent directly via Meta API`);
          }
        } catch (e: any) {
          console.error(`[Webhook] ❌ Direct DM error: ${e.message}`);
        }
      }
    }

    // ── HIDE comment ─────────────────────────────────────────────────────
    if (shouldHide) {
      try {
        console.log(`[Webhook] Hiding comment ${commentId}`);
        await fetch(`https://graph.facebook.com/v21.0/${commentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_hidden: true, access_token: token }),
        });
      } catch (e: any) {
        console.error(`[Webhook] ❌ Hide comment error: ${e.message}`);
      }
    }

    // Update trigger count
    await supabase.from("automation_rules").update({
      trigger_count: (rule.trigger_count || 0) + 1,
      last_triggered: new Date().toISOString(),
    }).eq("id", rule.id);

    console.log(`[Webhook] ✅ Rule "${rule.name}" executed. Trigger count: ${(rule.trigger_count || 0) + 1}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Enqueue message via Backend Send Queue (Compliance Pipeline)
// Replaces direct Meta API calls. All messages now go through:
// Compliance Check → Rate Limiter → Send Queue → Meta API
// ─────────────────────────────────────────────────────────────
async function enqueueViaBackend(opts: {
  accountId: string;
  userId: string;
  recipientId: string;
  messagePayload: { text: string; link?: string };
  messageType: string;
  automationRuleId?: string;
}) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/messaging/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": WORKER_SECRET,
      },
      body: JSON.stringify(opts),
    });

    const data = await res.json();

    if (data.blocked) {
      console.log(`[Webhook] Message blocked by compliance: ${data.blockReason}`);
    } else if (data.queued) {
      console.log(`[Webhook] ✅ Message enqueued: queue=${data.queueId}`);
    } else {
      console.warn(`[Webhook] Enqueue returned unexpected result:`, data);
    }

    return data;
  } catch (err: any) {
    console.error(`[Webhook] Failed to enqueue message:`, err.message);
    // Fallback: log the failure but don't crash the webhook handler
    return { queued: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────
// Signature verification
// ─────────────────────────────────────────────────────────────
function verifySignature(body: string, signature: string): boolean {
  // SECURITY: Signature verification is mandatory in production.
  // META_SKIP_SIGNATURE_CHECK removed — all webhooks must be signed.
  if (!META_APP_SECRET) {
    console.warn("[Webhook] META_APP_SECRET not set — REJECTING webhook (set META_APP_SECRET in env)");
    // In production, reject unsigned webhooks. In dev, allow with warning.
    if (process.env.NODE_ENV === "production") return false;
    console.warn("[Webhook] Allowing unsigned webhook in development mode ONLY");
    return true;
  }

  if (!signature) {
    console.warn("[Webhook] No signature header received — rejecting");
    return false;
  }

  try {
    const expected = "sha256=" +
      crypto.createHmac("sha256", META_APP_SECRET)
        .update(Buffer.from(body, "utf-8"))
        .digest("hex");

    // Timing-safe comparison
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) {
      console.warn("[Webhook] Signature length mismatch");
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch (e) {
    console.error("[Webhook] Signature verification error:", e);
    return false;
  }
}
