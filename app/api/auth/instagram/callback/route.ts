import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const META_APP_ID = process.env.META_APP_ID!;
const META_APP_SECRET = process.env.META_APP_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/connect?error=oauth_denied`);
  }

  try {
    const redirectUri = `${APP_URL}/api/auth/instagram/callback`;

    // 1. Exchange code for short-lived user access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      throw new Error(tokenData.error?.message || "Token exchange failed");
    }

    // 2. Exchange for long-lived token (60 days)
    const llRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${META_APP_ID}&` +
      `client_secret=${META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const llData = await llRes.json();
    const longLivedToken = llData.access_token || tokenData.access_token;
    const expiresIn = llData.expires_in || 5183944; // ~60 days

    // 3. Get Instagram Business Account linked to Facebook account
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account,name,access_token&access_token=${longLivedToken}`
    );
    const pagesData = await pagesRes.json();

    // 4. For each Page with an Instagram Business Account
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${APP_URL}/?auth_required=1`);
    }

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    for (const page of (pagesData.data || [])) {
      const igAccount = page.instagram_business_account;
      if (!igAccount) continue;

      // 5. Get Instagram profile data
      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/${igAccount.id}?` +
        `fields=id,username,name,biography,followers_count,media_count,profile_picture_url,account_type&` +
        `access_token=${longLivedToken}`
      );
      const igData = await igRes.json();

      // 6. Upsert connected account
      await supabase.from("connected_accounts").upsert({
        user_id: user.id,
        platform: "instagram",
        platform_user_id: igData.id,
        platform_username: igData.username,
        platform_name: igData.name,
        avatar_url: igData.profile_picture_url,
        access_token: longLivedToken,
        token_expires_at: tokenExpiresAt,
        account_type: igData.account_type || "BUSINESS",
        page_id: page.id,
        page_name: page.name,
        permissions: [
          "instagram_basic",
          "instagram_manage_insights",
          "instagram_content_publish",
          "instagram_manage_messages",
          "instagram_manage_comments",
        ],
        is_active: true,
      }, {
        onConflict: "user_id,platform,platform_user_id",
      });
    }

    return NextResponse.redirect(`${APP_URL}/connect?success=instagram`);
  } catch (err: any) {
    console.error("Instagram OAuth error:", err);
    return NextResponse.redirect(`${APP_URL}/connect?error=${encodeURIComponent(err.message)}`);
  }
}
