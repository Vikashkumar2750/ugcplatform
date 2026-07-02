import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin@123";

/**
 * POST /api/admin/grant-multi-account
 * Super admin grants Pro multi-account access to a user by email.
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin auth via cookie or header
    const adminPw = request.cookies.get("admin_session")?.value;
    if (adminPw !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, maxAccountsPerPlatform } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const maxAccounts = Math.min(10, Math.max(1, maxAccountsPerPlatform || 5));

    // Use service role for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find user by email
    const { data: users, error: userError } = await supabase
      .from("profiles")
      .select("id, email, subscription_tier, max_accounts_per_platform")
      .eq("email", email)
      .limit(1);

    if (userError) throw userError;
    if (!users || users.length === 0) {
      return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
    }

    const user = users[0];

    // Update profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        subscription_tier: "admin_granted",
        max_accounts_per_platform: maxAccounts,
        subscription_expires_at: null, // No expiry for admin-granted
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `✅ Granted Pro access to ${email}: ${maxAccounts} accounts per platform (no expiry)`,
      user: {
        id: user.id,
        email: user.email,
        previousTier: user.subscription_tier,
        newTier: "admin_granted",
        maxAccountsPerPlatform: maxAccounts,
      },
    });
  } catch (err: any) {
    console.error("[grant-multi-account]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
