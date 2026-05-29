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

    // ── Step 1: Exchange code → short-lived user token ──
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("[IG Callback] Token exchange failed:", JSON.stringify(tokenData));
      throw new Error(tokenData.error?.message || "Token exchange failed");
    }

    // ── Step 2: Exchange → long-lived user token (60 days) ──
    const llRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${META_APP_ID}&` +
      `client_secret=${META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const llData = await llRes.json();
    const userLongToken = llData.access_token || tokenData.access_token;
    const expiresIn = llData.expires_in || 5183944; // ~60 days
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // ── Step 3: Get Supabase user ──
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${APP_URL}/?auth_required=1`);
    }

    // ── Step 4: Get FB Pages (with individual page access tokens) ──
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?` +
      `fields=id,name,access_token&` +
      `access_token=${userLongToken}`
    );
    const pagesData = await pagesRes.json();

    console.log("[IG Callback] Pages found:", pagesData.data?.length ?? 0);

    let accountSaved = false;

    for (const page of (pagesData.data || [])) {
      const pageAccessToken = page.access_token; // PAGE-level token — KEY FIX

      // ── Step 5: Use PAGE TOKEN to get linked Instagram account ──
      // Creator + Business accounts both work with page token
      const pageDetailRes = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}?` +
        `fields=instagram_business_account&` +
        `access_token=${pageAccessToken}`   // ← Must use page token, not user token
      );
      const pageDetail = await pageDetailRes.json();

      console.log(`[IG Callback] Page "${page.name}" IG account:`, pageDetail.instagram_business_account?.id ?? "none");

      if (!pageDetail.instagram_business_account?.id) continue;

      const igAccountId = pageDetail.instagram_business_account.id;

      // ── Step 6: Fetch full Instagram profile with page token ──
      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/${igAccountId}?` +
        `fields=id,username,name,biography,followers_count,media_count,profile_picture_url,account_type&` +
        `access_token=${pageAccessToken}`
      );
      const igData = await igRes.json();

      console.log("[IG Callback] IG profile fetched:", igData.username, "type:", igData.account_type);

      if (!igData.id || !igData.username) {
        console.warn("[IG Callback] IG profile missing data:", igData);
        continue;
      }

      // ── Step 7: Upsert connected_accounts ──
      const { error: upsertError } = await supabase.from("connected_accounts").upsert({
        user_id: user.id,
        platform: "instagram",
        platform_user_id: igData.id,
        platform_username: igData.username,
        platform_name: igData.name || igData.username,
        avatar_url: igData.profile_picture_url || null,
        access_token: pageAccessToken,          // Store PAGE token — needed for Graph API calls
        token_expires_at: tokenExpiresAt,
        account_type: igData.account_type || "CREATOR",
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

      if (upsertError) {
        console.error("[IG Callback] DB upsert error:", upsertError.message);
        continue;
      }

      accountSaved = true;
      console.log(`[IG Callback] ✓ Account saved: @${igData.username} (${igData.account_type})`);
    }

    if (!accountSaved) {
      console.error("[IG Callback] No Instagram account saved. Pages data:", JSON.stringify(pagesData));
      // Redirect with debug info in query (safe — just account type message)
      return NextResponse.redirect(
        `${APP_URL}/connect?error=no_ig_business_account`
      );
    }

    return NextResponse.redirect(`${APP_URL}/connect?success=instagram`);

  } catch (err: any) {
    console.error("[IG Callback] Unhandled error:", err);
    return NextResponse.redirect(
      `${APP_URL}/connect?error=${encodeURIComponent(err.message || "unknown_error")}`
    );
  }
}
