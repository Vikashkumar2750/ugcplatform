import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// REQUIRED by Meta — called when user removes your app from Facebook Settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.formData();
    const signedRequest = body.get("signed_request") as string;

    if (!signedRequest) {
      return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
    }

    const [, payload] = signedRequest.split(".");
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    const userId = data.user_id;

    // Mark connected accounts as inactive for this Facebook user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from("connected_accounts")
      .update({ is_active: false })
      .eq("platform_user_id", userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Deauthorize error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
