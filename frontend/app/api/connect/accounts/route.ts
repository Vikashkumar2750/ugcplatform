import { NextRequest, NextResponse } from "next/server";

// GET /api/connect/accounts — get all connected accounts for current user
export async function GET(request: NextRequest) {
  // Return empty if Supabase is not configured yet
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ accounts: [], configured: false });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ accounts: [], configured: true });
    }

    const { data: accounts, error } = await supabase
      .from("connected_accounts")
      .select("id, platform, platform_user_id, platform_username, platform_name, avatar_url, account_type, permissions, connected_at, token_expires_at, is_active, page_id, page_name")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("connected_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ accounts: accounts || [], configured: true });
  } catch (err: any) {
    console.error("[/api/connect/accounts]", err.message);
    return NextResponse.json({ accounts: [], configured: false });
  }
}
