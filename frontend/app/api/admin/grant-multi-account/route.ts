import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isAdminSessionValid(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  try {
    const dotIdx = cookieValue.lastIndexOf(".");
    if (dotIdx === -1) return false;
    const payloadB64 = cookieValue.substring(0, dotIdx);
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf-8"));
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    const emailMatch = payload.email?.toLowerCase().trim() === adminEmail;
    const roleMatch = payload.role === "admin";
    const isExpired = Date.now() - payload.ts > 7 * 24 * 60 * 60 * 1000;
    return emailMatch && roleMatch && !isExpired;
  } catch {
    return false;
  }
}

/**
 * POST /api/admin/grant-multi-account
 * Super admin grants Pro multi-account access to a user by email.
 */
export async function POST(request: NextRequest) {
  try {
    const adminPw = request.cookies.get("admin_session")?.value;
    if (!isAdminSessionValid(adminPw)) {
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

    // Find user by email via auth API (profiles may not have email column)
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const authUser = authUsers?.users?.find(
      u => u.email?.toLowerCase().trim() === email.toLowerCase().trim()
    );

    if (!authUser) {
      return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
    }

    const userId = authUser.id;

    // Update profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        subscription_tier: "admin_granted",
        max_accounts_per_platform: maxAccounts,
        subscription_expires_at: null, // No expiry for admin-granted
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `✅ Granted Pro access to ${email}: ${maxAccounts} accounts per platform (no expiry)`,
      user: {
        id: userId,
        email,
        newTier: "admin_granted",
        maxAccountsPerPlatform: maxAccounts,
      },
    });
  } catch (err: any) {
    console.error("[grant-multi-account]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
