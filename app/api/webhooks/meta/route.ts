import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN!;
const META_APP_SECRET = process.env.META_APP_SECRET!;

// Supabase service role client (bypasses RLS)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — Meta webhook verification challenge
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Meta webhook verified ✓");
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// POST — Receive Meta webhook events
export async function POST(request: NextRequest) {
  try {
    // Verify signature
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256") || "";

    if (!verifySignature(rawBody, signature)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const supabase = getServiceClient();

    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        await processWebhookEvent(supabase, {
          platform: body.object, // 'instagram' | 'page'
          eventType: change.field,
          payload: change.value,
          senderId: change.value?.from?.id,
          recipientId: change.value?.to?.id || entry.id,
        });
      }

      // Handle messaging events (DMs)
      for (const messaging of (entry.messaging || [])) {
        await processMessagingEvent(supabase, messaging, entry.id);
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new NextResponse("OK", { status: 200 }); // Always return 200 to Meta
  }
}

async function processWebhookEvent(
  supabase: any,
  event: {
    platform: string;
    eventType: string;
    payload: any;
    senderId?: string;
    recipientId?: string;
  }
) {
  // 1. Log the event
  const { data: webhookEvent } = await supabase
    .from("webhook_events")
    .insert({
      platform: event.platform,
      event_type: event.eventType,
      sender_id: event.senderId,
      recipient_id: event.recipientId,
      payload: event.payload,
      processed: false,
    })
    .select()
    .single();

  // 2. Find matching automation rules
  if (event.eventType === "comments") {
    await processCommentEvent(supabase, event.payload, webhookEvent?.id);
  }

  if (event.eventType === "mentions") {
    await processMentionEvent(supabase, event.payload, webhookEvent?.id);
  }
}

async function processMessagingEvent(
  supabase: any,
  messaging: any,
  pageId: string
) {
  if (!messaging.message) return; // Skip delivery receipts, reads

  const senderId = messaging.sender?.id;
  const messageText = messaging.message?.text?.toLowerCase() || "";

  // Log DM event
  await supabase.from("webhook_events").insert({
    platform: "facebook",
    event_type: "message",
    sender_id: senderId,
    recipient_id: pageId,
    payload: messaging,
    processed: false,
  });

  // Find connected account for this page
  const { data: account } = await supabase
    .from("connected_accounts")
    .select("id, user_id, access_token")
    .eq("page_id", pageId)
    .eq("is_active", true)
    .single();

  if (!account) return;

  // Check if sender opted out
  const { data: conversation } = await supabase
    .from("dm_conversations")
    .select("opted_out")
    .eq("account_id", account.id)
    .eq("sender_id", senderId)
    .single();

  if (conversation?.opted_out) return; // Respect opt-out — REQUIRED by Meta

  // Find matching DM automation rules
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("account_id", account.id)
    .eq("type", "dm_keyword")
    .eq("is_active", true);

  for (const rule of (rules || [])) {
    const keywords: string[] = rule.trigger_config?.keywords || [];
    const matchType: string = rule.trigger_config?.match_type || "any";

    const matched = matchType === "any"
      ? keywords.some(k => messageText.includes(k.toLowerCase()))
      : keywords.every(k => messageText.includes(k.toLowerCase()));

    if (matched) {
      await sendAutomatedReply(account.access_token, senderId, rule.action_config, pageId);
      await supabase.from("automation_rules").update({
        trigger_count: rule.trigger_count + 1,
        last_triggered: new Date().toISOString(),
      }).eq("id", rule.id);
      break; // Only trigger first matching rule
    }
  }

  // Handle opt-out keywords
  const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "optout", "opt out", "cancel"];
  if (OPT_OUT_KEYWORDS.some(k => messageText.includes(k))) {
    await supabase.from("dm_conversations").upsert({
      account_id: account.id,
      user_id: account.user_id,
      sender_id: senderId,
      opted_out: true,
    }, { onConflict: "account_id,sender_id" });
  }
}

async function sendAutomatedReply(
  accessToken: string,
  recipientId: string,
  actionConfig: any,
  pageId: string
) {
  const delay = actionConfig.delay_seconds || 0;
  if (delay > 0) {
    await new Promise(r => setTimeout(r, delay * 1000));
  }

  const message: any = { text: actionConfig.message || "Namaste! 🙏" };

  // Add quick reply buttons if configured
  if (actionConfig.buttons?.length > 0) {
    message.quick_replies = actionConfig.buttons.map((b: any) => ({
      content_type: "text",
      title: b.label,
      payload: b.payload,
    }));
  }

  await fetch(`https://graph.facebook.com/v21.0/${pageId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message,
      access_token: accessToken,
    }),
  });
}

async function processCommentEvent(
  supabase: any,
  payload: any,
  webhookEventId?: string
) {
  const commentText = payload?.text?.toLowerCase() || "";
  const commentId = payload?.id;
  const mediaId = payload?.media?.id;

  // Find matching comment automation rules
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("*, connected_accounts(access_token, page_id)")
    .in("type", ["comment_reply", "comment_to_dm"])
    .eq("is_active", true);

  for (const rule of (rules || [])) {
    const keywords: string[] = rule.trigger_config?.keywords || [];
    const matched = keywords.length === 0 || keywords.some(k => commentText.includes(k.toLowerCase()));
    if (!matched) continue;

    const token = rule.connected_accounts?.access_token;
    if (!token) continue;

    if (rule.type === "comment_reply" && rule.action_config?.reply_text) {
      // Reply to comment
      await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: rule.action_config.reply_text,
          access_token: token,
        }),
      });
    }

    if (rule.type === "comment_to_dm" && payload?.from?.id) {
      // Send DM to commenter
      await sendAutomatedReply(token, payload.from.id, rule.action_config, rule.connected_accounts?.page_id);
    }

    await supabase.from("automation_rules").update({
      trigger_count: rule.trigger_count + 1,
      last_triggered: new Date().toISOString(),
    }).eq("id", rule.id);
  }
}

async function processMentionEvent(
  supabase: any,
  payload: any,
  webhookEventId?: string
) {
  // Log mention — future: trigger mention-based automation
  console.log("Mention event:", payload);
}

function verifySignature(body: string, signature: string): boolean {
  if (!META_APP_SECRET) return true; // Skip in dev if not configured

  try {
    const crypto = require("crypto");
    const expectedSignature = "sha256=" +
      crypto.createHmac("sha256", META_APP_SECRET).update(body).digest("hex");
    return signature === expectedSignature;
  } catch {
    return false;
  }
}
