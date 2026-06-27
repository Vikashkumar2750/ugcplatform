import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getUser(token);
  return data.user;
}

// ─── POST /api/automation/rules/publish ──────────────────────────────────────
// Publish a draft automation rule: copies draft_config → published_config,
// increments version, and activates the rule.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ruleId, action } = await request.json();
  if (!ruleId) {
    return NextResponse.json({ error: "ruleId is required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Fetch the rule
  const { data: rule, error: fetchError } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("id", ruleId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  if (action === "publish") {
    // ── Publish: draft → published ───────────────────────────────────────
    const draftTrigger = rule.draft_trigger_config || rule.trigger_config;
    const draftAction = rule.draft_action_config || rule.action_config;

    const { error } = await supabase
      .from("automation_rules")
      .update({
        // Save current published config as previous (for rollback)
        previous_trigger_config: rule.published_trigger_config || rule.trigger_config,
        previous_action_config: rule.published_action_config || rule.action_config,
        // Promote draft to published
        published_trigger_config: draftTrigger,
        published_action_config: draftAction,
        // Also update the active config
        trigger_config: draftTrigger,
        action_config: draftAction,
        // Clear draft
        draft_trigger_config: null,
        draft_action_config: null,
        // Metadata
        publish_status: "published",
        version: (rule.version || 1) + 1,
        published_at: new Date().toISOString(),
        is_active: true,
      })
      .eq("id", ruleId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      version: (rule.version || 1) + 1,
      message: "Rule published successfully",
    });

  } else if (action === "rollback") {
    // ── Rollback: revert to previous published config ─────────────────
    if (!rule.previous_trigger_config || !rule.previous_action_config) {
      return NextResponse.json({
        error: "No previous version to rollback to",
      }, { status: 400 });
    }

    const { error } = await supabase
      .from("automation_rules")
      .update({
        // Restore previous config
        published_trigger_config: rule.previous_trigger_config,
        published_action_config: rule.previous_action_config,
        trigger_config: rule.previous_trigger_config,
        action_config: rule.previous_action_config,
        // Clear previous (one-level rollback only)
        previous_trigger_config: null,
        previous_action_config: null,
        // Also clear any pending draft
        draft_trigger_config: null,
        draft_action_config: null,
        // Metadata
        publish_status: "published",
        version: Math.max(1, (rule.version || 1) - 1),
        published_at: new Date().toISOString(),
      })
      .eq("id", ruleId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Rolled back to previous version",
    });

  } else if (action === "save_draft") {
    // ── Save as draft (without publishing) ────────────────────────────
    const { triggerConfig, actionConfig } = await request.json().catch(() => ({}));

    const { error } = await supabase
      .from("automation_rules")
      .update({
        draft_trigger_config: triggerConfig || rule.trigger_config,
        draft_action_config: actionConfig || rule.action_config,
        publish_status: "draft",
      })
      .eq("id", ruleId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Draft saved — publish when ready",
    });

  } else if (action === "pause") {
    // ── Pause: deactivate without losing config ───────────────────────
    const { error } = await supabase
      .from("automation_rules")
      .update({
        is_active: false,
        publish_status: "paused",
      })
      .eq("id", ruleId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Rule paused" });

  } else {
    return NextResponse.json({
      error: "Invalid action. Use: publish, rollback, save_draft, or pause",
    }, { status: 400 });
  }
}
