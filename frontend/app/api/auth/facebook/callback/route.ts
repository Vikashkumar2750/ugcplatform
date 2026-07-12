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
    const redirectUri = `${APP_URL}/api/auth/facebook/callback`;

    // 1. Exchange code for short-lived user token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("Token exchange failed");

    // 2. Exchange short-lived user token for long-lived user token
    const llUserRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${META_APP_ID}&` +
      `client_secret=${META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const llUserData = await llUserRes.json();
    const longLivedUserToken = llUserData.access_token || tokenData.access_token;

    // 3. Get list of managed pages using the LONG-LIVED user token
    // This ensures the page.access_token returned is a never-expiring Page Token!
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?` +
      `fields=id,name,category,access_token,fan_count,link,picture&` +
      `access_token=${longLivedUserToken}`
    );
    const pagesData = await pagesRes.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${APP_URL}/?auth_required=1`);

    // 4. Upsert each page as a separate connected account
    for (const page of (pagesData.data || [])) {
      const pageToken = page.access_token;

      await supabase.from("connected_accounts").upsert({
        user_id: user.id,
        platform: "facebook",
        platform_user_id: page.id,
        platform_name: page.name,
        platform_username: page.name.toLowerCase().replace(/\s+/g, ""),
        avatar_url: page.picture?.data?.url,
        access_token: pageToken,
        token_expires_at: null, // Page tokens don't expire
        account_type: "PAGE",
        page_id: page.id,
        page_name: page.name,
        permissions: [
          "pages_show_list",
          "pages_read_engagement",
          "pages_messaging",
          "business_management",
        ],
        is_active: true,
      }, {
        onConflict: "user_id,platform,platform_user_id",
      });
    }

    return NextResponse.redirect(`${APP_URL}/connect?success=facebook`);
  } catch (err: any) {
    console.error("Facebook OAuth error:", err);
    return NextResponse.redirect(`${APP_URL}/connect?error=${encodeURIComponent(err.message)}`);
  }
}
