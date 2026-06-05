import { NextRequest, NextResponse } from "next/server";

// POST /api/connect/disconnect
export async function POST(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  try {
    const { platform, accountId } = await request.json();
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Soft-delete: mark as inactive rather than delete
    const query = supabase
      .from("connected_accounts")
      .update({ is_active: false })
      .eq("user_id", user.id);

    if (accountId) {
      query.eq("id", accountId);
    } else if (platform) {
      query.eq("platform", platform);
    } else {
      return NextResponse.json({ error: "Provide platform or accountId" }, { status: 400 });
    }

    const { error } = await query;
    if (error) throw error;

    // Pause associated automation rules
    if (platform) {
      // Fetch IDs first — .in() does not support subqueries
      const { data: accountIds } = await supabase
        .from("connected_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("platform", platform);

      const ids = (accountIds || []).map((a: { id: string }) => a.id);
      if (ids.length > 0) {
        await supabase
          .from("automation_rules")
          .update({ is_active: false })
          .eq("user_id", user.id)
          .in("account_id", ids);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[/api/connect/disconnect]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
