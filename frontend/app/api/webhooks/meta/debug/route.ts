import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/webhooks/meta/debug
 * Shows recent webhook events from the database to diagnose
 * whether Meta is sending events at all.
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

  // 2. Check connected accounts with their tokens (masked)
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
      // We need the token for this - fetch it
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

  // 5. Environment check (don't expose secrets, just check they exist)
  const envCheck = {
    META_APP_ID: !!process.env.META_APP_ID,
    META_APP_SECRET: !!process.env.META_APP_SECRET ? `SET (${process.env.META_APP_SECRET?.substring(0, 4)}...${process.env.META_APP_SECRET?.slice(-4)})` : "MISSING ❌",
    META_WEBHOOK_VERIFY_TOKEN: !!process.env.META_WEBHOOK_VERIFY_TOKEN ? "SET ✅" : "MISSING ❌",
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET ✅" : "MISSING ❌",
    RENDER_WORKER_URL: process.env.RENDER_WORKER_URL || "NOT SET",
    NODE_ENV: process.env.NODE_ENV || "unknown",
  };

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
      "5_recent_webhook_events": recentEvents.length > 0 ? recentEvents : (eventsError ? `Error: ${eventsError}` : "NO EVENTS RECEIVED ❌ — Meta may not be sending webhooks"),
    },
    conclusion: recentEvents.length === 0 && !eventsError
      ? "❌ ZERO webhook events in database. Meta is NOT sending events to your endpoint. Check: 1) Webhook URL in Meta Dev Console, 2) Verify token matches, 3) App is Live, 4) Instagram webhook fields (comments, messages) are subscribed in the console"
      : recentEvents.length > 0
        ? `✅ ${recentEvents.length} recent events found — webhook IS receiving events`
        : `⚠️ Could not check events: ${eventsError}`,
  });
}
