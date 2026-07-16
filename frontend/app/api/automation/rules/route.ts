import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getUserId(): Promise<string | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch { return null; }
}


// GET — list automation rules for current user
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const platform = searchParams.get("platform");

  const supabase = getServiceClient();
  let query = supabase
    .from("automation_rules")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (platform) {
    query = query.eq("platform", platform);
  }

  if (type) {
    if (type === "comments") {
      query = query.in("type", ["comment_reply", "comment_to_dm", "hide_comment", "comment_automation"]);
    } else if (type === "dm") {
      query = query.in("type", ["dm_keyword", "dm_new_follower", "story_reply"]);
    } else {
      query = query.eq("type", type);
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data || [] });
}

// POST — create new automation rule
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, type, platform = "instagram", keywords, replyText, replyTexts, dmMessage, dmMessages, dmLink, dmLinkLabel, delay, matchType, mediaId, mediaThumb, mediaCaption, actionsEnabled, hide, account_id, requireFollow, followPromptMessages, followUpEnabled, followUpDelay, followUpMessages } = body;

  if (!name || !type) return NextResponse.json({ error: "name and type required" }, { status: 400 });

  const supabase = getServiceClient();

  // Get user's connected account id (multi-account aware)
  let resolvedAccountId = account_id || null;
  if (!resolvedAccountId) {
    const { data: account } = await supabase
      .from("connected_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("platform", platform)
      .eq("is_active", true)
      .limit(1)
      .single();
    resolvedAccountId = account?.id || null;
  }

  const trigger_config: any = {
    keywords: keywords || [],
    match_type: matchType || "any",
    media_id: mediaId || null,
    media_thumb: mediaThumb || null,
    media_caption: mediaCaption || null,
  };

  const action_config: any = {
    message: dmMessage || "",
    messages: dmMessages || (dmMessage ? [dmMessage] : []),
    reply_text: replyText || "",
    reply_texts: replyTexts || (replyText ? [replyText] : []),
    link: dmLink || "",
    button_label: dmLinkLabel || "",
    delay_seconds: delay || 0,
    hide: hide || false,
    actions_enabled: actionsEnabled || null,
    require_follow: requireFollow || false,
    follow_prompt_messages: followPromptMessages || [],
    follow_up_enabled: followUpEnabled || false,
    follow_up_delay: followUpDelay || 0,
    follow_up_messages: followUpMessages || []
  };

  const { data, error } = await supabase
    .from("automation_rules")
    .insert({
      user_id: userId,
      account_id: resolvedAccountId,
      platform,          // ← was missing, caused NOT NULL violation
      name,
      type,
      trigger_config,
      action_config,
      is_active: true,
      trigger_count: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

// PATCH — toggle active / update rule
export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, is_active } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("automation_rules")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — remove rule
export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("automation_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
