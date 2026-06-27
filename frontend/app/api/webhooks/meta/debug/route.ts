import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/webhooks/meta/debug
 * Shows recent webhook events + raw logs from the database.
 * 
 * POST /api/webhooks/meta/debug
 * Simulates a test comment to verify rule matching + API token validity.
 */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const supabase = getServiceClient();

  // 1. Check webhook_events table for recent events
  let recentEvents: any[] = [];
  let eventsError = "";
  try {
    const { data, error } = await supabase
      .from("webhook_events")
      .select("id, platform, event_type, sender_id, recipient_id, payload, processed, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) eventsError = error.message;
    else recentEvents = data || [];
  } catch (e: any) {
    eventsError = e.message;
  }

  // 1b. Check raw webhook logs
  let rawLogs: any[] = [];
  try {
    const { data } = await supabase
      .from("webhook_raw_log")
      .select("id, object_type, raw_body, received_at")
      .order("received_at", { ascending: false })
      .limit(5);
    rawLogs = data || [];
  } catch {}

  // 2. Check connected accounts
  let accounts: any[] = [];
  try {
    const { data } = await supabase
      .from("connected_accounts")
      .select("id, platform, platform_username, platform_user_id, page_id, page_name, is_active, permissions, token_expires_at")
      .eq("is_active", true);
    accounts = (data || []).map(a => ({
      ...a,
      token_status: a.token_expires_at
        ? new Date(a.token_expires_at) > new Date() ? "VALID" : "EXPIRED"
        : "UNKNOWN",
    }));
  } catch {}

  // 3. Check automation rules
  let rules: any[] = [];
  try {
    const { data } = await supabase
      .from("automation_rules")
      .select("id, name, type, is_active, trigger_config, action_config, account_id, user_id, trigger_count, last_triggered")
      .eq("is_active", true)
      .in("type", ["comment_reply", "comment_to_dm", "hide_comment", "comment_automation"]);
    rules = data || [];
  } catch {}

  // 4. Check subscription status
  let subscriptionResults: any[] = [];
  for (const acc of accounts.filter(a => a.page_id)) {
    try {
      const { data: fullAcc } = await supabase
        .from("connected_accounts")
        .select("access_token")
        .eq("id", acc.id)
        .single();
      
      if (fullAcc?.access_token) {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${acc.page_id}/subscribed_apps?access_token=${fullAcc.access_token}`
        );
        const data = await res.json();
        subscriptionResults.push({
          page_id: acc.page_id,
          page_name: acc.page_name,
          subscriptions: data.data || [],
          error: data.error?.message || null,
        });
      }
    } catch {}
  }

  // 5. Environment check
  const envCheck = {
    META_APP_ID: !!process.env.META_APP_ID,
    META_APP_SECRET: !!process.env.META_APP_SECRET ? `SET (${process.env.META_APP_SECRET?.substring(0, 4)}...${process.env.META_APP_SECRET?.slice(-4)})` : "MISSING ❌",
    META_WEBHOOK_VERIFY_TOKEN: !!process.env.META_WEBHOOK_VERIFY_TOKEN ? "SET ✅" : "MISSING ❌",
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET ✅" : "MISSING ❌",
    RENDER_WORKER_URL: process.env.RENDER_WORKER_URL || "NOT SET",
    NODE_ENV: process.env.NODE_ENV || "unknown",
  };

  // Count event types
  const eventTypes: Record<string, number> = {};
  for (const e of recentEvents) {
    eventTypes[e.event_type] = (eventTypes[e.event_type] || 0) + 1;
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    diagnosis: {
      "1_env_vars": envCheck,
      "2_connected_accounts": accounts,
      "3_page_subscriptions": subscriptionResults,
      "4_active_comment_rules": rules.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        keywords: r.trigger_config?.keywords || [],
        has_account_id: !!r.account_id,
        account_id: r.account_id,
        user_id: r.user_id,
        reply_enabled: !!r.action_config?.reply_text || !!r.action_config?.actions_enabled?.reply,
        dm_enabled: !!r.action_config?.message || !!r.action_config?.actions_enabled?.dm,
        trigger_count: r.trigger_count,
        last_triggered: r.last_triggered,
      })),
      "5_event_type_breakdown": eventTypes,
      "6_recent_webhook_events": recentEvents.length > 0 ? recentEvents : (eventsError ? `Error: ${eventsError}` : "NO EVENTS RECEIVED ❌"),
      "7_raw_webhook_logs": rawLogs.length > 0 ? rawLogs : "No raw logs yet",
    },
    conclusion: `${recentEvents.length} events | Types: ${JSON.stringify(eventTypes)}`,
    action_needed: !eventTypes["comments"] && !eventTypes["feed"]
      ? "❌ NO comment events received! POST /api/webhooks/meta/debug to test rule matching"
      : null,
  });
}

// POST — Simulate a test comment to verify rules + token
export async function POST(request: NextRequest) {
  const supabase = getServiceClient();

  const { data: acc } = await supabase
    .from("connected_accounts")
    .select("id, user_id, access_token, platform_user_id, page_id")
    .eq("is_active", true)
    .eq("platform", "instagram")
    .single();

  if (!acc) {
    return NextResponse.json({ error: "No connected Instagram account found" }, { status: 404 });
  }

  // Test rule matching
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("*")
    .in("type", ["comment_reply", "comment_to_dm", "hide_comment", "comment_automation"])
    .eq("is_active", true)
    .eq("user_id", acc.user_id);

  const matchResults = [];
  for (const rule of (rules || [])) {
    const keywords: string[] = rule.trigger_config?.keywords || [];
    const matchType: string = rule.trigger_config?.match_type || "any";
    const commentText = "test";
    const matched = keywords.length === 0
      ? true
      : matchType === "all"
        ? keywords.every((k: string) => commentText.includes(k.toLowerCase()))
        : keywords.some((k: string) => commentText.includes(k.toLowerCase()));

    const actionsEnabled = rule.action_config?.actions_enabled;
    const isUnified = rule.type === "comment_automation";
    
    matchResults.push({
      rule_name: rule.name,
      rule_type: rule.type,
      keywords,
      would_match: matched,
      reply_would_fire: isUnified ? !!actionsEnabled?.reply : rule.type === "comment_reply",
      dm_would_fire: isUnified ? !!actionsEnabled?.dm : rule.type === "comment_to_dm",
      has_reply_text: !!rule.action_config?.reply_text,
      has_dm_message: !!rule.action_config?.message,
      reply_text: rule.action_config?.reply_text?.substring(0, 50) || null,
      dm_message: rule.action_config?.message?.substring(0, 50) || null,
    });
  }

  // Test Graph API access
  let apiTest: any = null;
  try {
    const mediaRes = await fetch(
      `https://graph.facebook.com/v21.0/${acc.platform_user_id}/media?fields=id,caption,comments_count&limit=3&access_token=${acc.access_token}`
    );
    const mediaData = await mediaRes.json();
    apiTest = {
      can_read_media: !mediaData.error,
      media_count: mediaData.data?.length || 0,
      first_media: mediaData.data?.[0] || null,
      error: mediaData.error?.message || null,
    };

    // Also test if we can read comments on the first post
    if (mediaData.data?.[0]?.id) {
      const commentsRes = await fetch(
        `https://graph.facebook.com/v21.0/${mediaData.data[0].id}/comments?fields=id,text,from,timestamp&limit=3&access_token=${acc.access_token}`
      );
      const commentsData = await commentsRes.json();
      apiTest.can_read_comments = !commentsData.error;
      apiTest.recent_comments = commentsData.data?.slice(0, 3) || [];
      apiTest.comments_error = commentsData.error?.message || null;
    }
  } catch (e: any) {
    apiTest = { error: e.message };
  }

  return NextResponse.json({
    message: "Test simulation results",
    connected_account: {
      id: acc.id,
      platform_user_id: acc.platform_user_id,
      page_id: acc.page_id,
      token_valid: !!acc.access_token,
    },
    rule_matching: matchResults,
    api_test: apiTest,
    conclusion: matchResults.some(r => r.would_match)
      ? "✅ Rules WOULD match a 'test' comment. Issue is Meta not sending comment webhooks to our endpoint."
      : "❌ No rules match. Check rule keywords.",
  });
}
