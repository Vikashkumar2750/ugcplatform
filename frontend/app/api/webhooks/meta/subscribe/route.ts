import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/webhooks/meta/subscribe
 * Forces webhook subscription for all connected pages.
 * Call this once after connecting accounts if automation isn't firing.
 * 
 * GET /api/webhooks/meta/subscribe
 * Diagnostic: shows subscription status of all connected pages.
 */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const supabase = getServiceClient();

  // Get all active connected accounts that have a page_id
  const { data: accounts, error } = await supabase
    .from("connected_accounts")
    .select("id, platform_username, page_id, page_name, platform, access_token, platform_user_id")
    .eq("is_active", true)
    .not("page_id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const acc of (accounts || [])) {
    // Check current subscriptions
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${acc.page_id}/subscribed_apps?access_token=${acc.access_token}`
      );
      const data = await res.json();
      results.push({
        username: acc.platform_username,
        page_id: acc.page_id,
        page_name: acc.page_name,
        ig_user_id: acc.platform_user_id,
        subscriptions: data.data || [],
        error: data.error?.message || null,
      });
    } catch (e: any) {
      results.push({
        username: acc.platform_username,
        page_id: acc.page_id,
        error: e.message,
      });
    }
  }

  return NextResponse.json({
    message: "Webhook subscription status for all connected pages",
    accounts_with_page: (accounts || []).length,
    results,
  });
}

export async function POST(request: NextRequest) {
  const supabase = getServiceClient();

  // Get all active connected accounts that have a page_id
  const { data: accounts, error } = await supabase
    .from("connected_accounts")
    .select("id, platform_username, page_id, page_name, access_token")
    .eq("is_active", true)
    .not("page_id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!accounts?.length) {
    return NextResponse.json({
      error: "No connected accounts with page_id found. Reconnect your Instagram account.",
      hint: "Go to /connect → Disconnect → Reconnect Instagram"
    }, { status: 404 });
  }

  const results = [];

  // Field sets to try — most complete first, then fallback
  const fieldSets = [
    "feed,messages,messaging_postbacks,mention",    // Full (needs pages_manage_metadata)
    "messages,messaging_postbacks",                  // Minimal (just DMs, no feed/mention)
  ];

  for (const acc of accounts) {
    let subscribed = false;
    let lastError = "";

    for (const fields of fieldSets) {
      try {
        const subRes = await fetch(
          `https://graph.facebook.com/v21.0/${acc.page_id}/subscribed_apps`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subscribed_fields: fields,
              access_token: acc.access_token,
            }),
          }
        );
        const subData = await subRes.json();

        if (subData.success) {
          console.log(`[Subscribe] ✅ Page ${acc.page_name} subscribed with fields: ${fields}`);
          results.push({
            username: acc.platform_username,
            page_id: acc.page_id,
            page_name: acc.page_name,
            success: true,
            fields_subscribed: fields,
            note: fields.includes("feed") ? "Full subscription" : "Partial — reconnect IG with updated permissions for full support",
          });
          subscribed = true;
          break;
        } else {
          lastError = subData.error?.message || "Unknown error";
          console.warn(`[Subscribe] Fields "${fields}" failed for ${acc.page_name}: ${lastError}`);
        }
      } catch (e: any) {
        lastError = e.message;
      }
    }

    if (!subscribed) {
      results.push({
        username: acc.platform_username,
        page_id: acc.page_id,
        page_name: acc.page_name,
        success: false,
        error: lastError,
        fix: "Reconnect Instagram at /connect to get updated permissions (pages_manage_metadata)",
      });
    }
  }

  return NextResponse.json({
    message: "Webhook subscription results",
    results,
  });
}
