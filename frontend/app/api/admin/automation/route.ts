import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/admin/automation — list all automation rules with user info
 */
export async function GET(request: NextRequest) {
  try {
    const adminPw = request.cookies.get("admin_session")?.value;
    if (!adminPw) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getServiceClient();

    // Get all rules
    const { data: rules, error } = await supabase
      .from("automation_rules")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    // Get unique user IDs and account IDs
    const userIds = [...new Set((rules || []).map(r => r.user_id))];
    const accountIds = [...new Set((rules || []).map(r => r.account_id).filter(Boolean))];

    // Fetch profiles
    let profileMap: Record<string, { full_name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const p of (profiles || [])) {
        profileMap[p.id] = { full_name: p.full_name || "", email: p.email || "" };
      }
    }

    // Fetch connected account usernames
    let accountMap: Record<string, string> = {};
    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from("connected_accounts")
        .select("id, platform_username")
        .in("id", accountIds);
      for (const a of (accounts || [])) {
        accountMap[a.id] = a.platform_username || "";
      }
    }

    // Merge
    const enrichedRules = (rules || []).map(r => ({
      ...r,
      user_email: profileMap[r.user_id]?.email || "",
      user_name: profileMap[r.user_id]?.full_name || "",
      account_username: r.account_id ? accountMap[r.account_id] || "" : "",
    }));

    return NextResponse.json({ rules: enrichedRules });
  } catch (err: any) {
    console.error("[admin/automation GET]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/automation — toggle a rule's active status
 */
export async function PATCH(request: NextRequest) {
  try {
    const adminPw = request.cookies.get("admin_session")?.value;
    if (!adminPw) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { ruleId, is_active } = await request.json();
    if (!ruleId) return NextResponse.json({ error: "ruleId required" }, { status: 400 });

    const supabase = getServiceClient();
    const { error } = await supabase
      .from("automation_rules")
      .update({ is_active: !!is_active, updated_at: new Date().toISOString() })
      .eq("id", ruleId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[admin/automation PATCH]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
