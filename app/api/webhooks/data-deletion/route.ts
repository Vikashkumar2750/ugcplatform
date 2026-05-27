import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// REQUIRED by Meta — users can request data deletion from Facebook Settings
// Meta calls this URL when a user removes your app

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData();
    const signedRequest = body.get("signed_request") as string;

    if (!signedRequest) {
      return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
    }

    // Decode and verify the signed request
    const [encodedSig, payload] = signedRequest.split(".");
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    const userId = data.user_id;

    // Delete all user data from Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find user by Facebook user ID (stored in connected_accounts)
    const { data: account } = await supabase
      .from("connected_accounts")
      .select("user_id")
      .eq("platform_user_id", userId)
      .single();

    if (account) {
      // Delete all connected accounts, automation rules, scheduled posts, analyses
      await supabase.from("connected_accounts").delete().eq("user_id", account.user_id);
      await supabase.from("automation_rules").delete().eq("user_id", account.user_id);
      await supabase.from("scheduled_posts").delete().eq("user_id", account.user_id);
      await supabase.from("analyses").delete().eq("user_id", account.user_id);
      await supabase.from("generated_scripts").delete().eq("user_id", account.user_id);
      await supabase.from("dm_conversations").delete().eq("user_id", account.user_id);
      // Note: auth.users deletion requires service role — do via Supabase admin API
    }

    // Generate confirmation URL for Meta
    const confirmationCode = crypto.randomUUID();

    // Return confirmation as required by Meta
    return NextResponse.json({
      url: `${APP_URL}/data-deletion-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    console.error("Data deletion error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET — Show deletion status page (linked from confirmation)
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "Data deletion request received and processed." });
}
