import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/connect?error=oauth_denied`);
  }

  try {
    const redirectUri = `${APP_URL}/api/auth/youtube/callback`;

    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("Token exchange error:", tokenData);
      const errorMessage = tokenData.error_description || tokenData.error || "Token exchange failed";
      throw new Error(`Token exchange failed: ${errorMessage}`);
    }

    // 2. Get YouTube channel info
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true&` +
      `access_token=${tokenData.access_token}`
    );
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];

    if (!channel) throw new Error("No YouTube channel found for this account");

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${APP_URL}/?auth_required=1`);

    const tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    // 3. Upsert connected account
    await supabase.from("connected_accounts").upsert({
      user_id: user.id,
      platform: "youtube",
      platform_user_id: channel.id,
      platform_username: channel.snippet?.customUrl || channel.id,
      platform_name: channel.snippet?.title,
      avatar_url: channel.snippet?.thumbnails?.default?.url,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: tokenExpiresAt,
      account_type: "CHANNEL",
      permissions: [
        "youtube.readonly",
        "yt-analytics.readonly",
        "youtube.upload",
      ],
      is_active: true,
    }, {
      onConflict: "user_id,platform,platform_user_id",
    });

    return NextResponse.redirect(`${APP_URL}/connect?success=youtube`);
  } catch (err: any) {
    console.error("YouTube OAuth error:", err);
    return NextResponse.redirect(`${APP_URL}/connect?error=${encodeURIComponent(err.message)}`);
  }
}
