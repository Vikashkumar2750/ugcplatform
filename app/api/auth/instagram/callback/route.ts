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
      console.error("Token exchange failed:", tokenData);
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
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3. Get Supabase user first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${APP_URL}/?auth_required=1`);
    }

    let accountSaved = false;

    // ── STRATEGY A: Via Facebook Pages (Business account linked to a Page) ──
    try {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?` +
        `fields=instagram_business_account,name,id,access_token&` +
        `access_token=${longLivedToken}`
      );
      const pagesData = await pagesRes.json();

      for (const page of (pagesData.data || [])) {
        const igAccount = page.instagram_business_account;
        if (!igAccount?.id) continue;

        // Get full Instagram profile
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${igAccount.id}?` +
          `fields=id,username,name,biography,followers_count,media_count,profile_picture_url,account_type&` +
          `access_token=${longLivedToken}`
        );
        const igData = await igRes.json();

        if (!igData.username) continue;

        await supabase.from("connected_accounts").upsert({
          user_id: user.id,
          platform: "instagram",
          platform_user_id: igData.id,
          platform_username: igData.username,
          platform_name: igData.name || igData.username,
          avatar_url: igData.profile_picture_url || null,
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

        accountSaved = true;
        console.log("✓ Saved IG account via Pages strategy:", igData.username);
      }
    } catch (strategyAErr) {
      console.error("Strategy A (Pages) failed:", strategyAErr);
    }

    // ── STRATEGY B: Direct user IG account (Creator / Business Login flow) ──
    if (!accountSaved) {
      try {
        // Try getting IG account linked to the user directly
        const meRes = await fetch(
          `https://graph.facebook.com/v21.0/me?` +
          `fields=id,name,picture,instagram_business_account&` +
          `access_token=${longLivedToken}`
        );
        const meData = await meRes.json();

        if (meData.instagram_business_account?.id) {
          const igRes = await fetch(
            `https://graph.facebook.com/v21.0/${meData.instagram_business_account.id}?` +
            `fields=id,username,name,biography,followers_count,profile_picture_url,account_type&` +
            `access_token=${longLivedToken}`
          );
          const igData = await igRes.json();

          if (igData.username) {
            await supabase.from("connected_accounts").upsert({
              user_id: user.id,
              platform: "instagram",
              platform_user_id: igData.id,
              platform_username: igData.username,
              platform_name: igData.name || igData.username,
              avatar_url: igData.profile_picture_url || null,
              access_token: longLivedToken,
              token_expires_at: tokenExpiresAt,
              account_type: igData.account_type || "BUSINESS",
              permissions: ["instagram_basic", "instagram_manage_insights", "instagram_content_publish"],
              is_active: true,
            }, {
              onConflict: "user_id,platform,platform_user_id",
            });

            accountSaved = true;
            console.log("✓ Saved IG account via Strategy B (me direct):", igData.username);
          }
        }
      } catch (strategyBErr) {
        console.error("Strategy B (me direct) failed:", strategyBErr);
      }
    }

    // ── STRATEGY C: Instagram Basic Display API approach ──
    if (!accountSaved) {
      try {
        // Get all accounts available via the token
        const userRes = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,name,picture&access_token=${longLivedToken}`
        );
        const userData = await userRes.json();

        // Try getting linked IG accounts through business API
        const bizRes = await fetch(
          `https://graph.facebook.com/v21.0/me/businesses?` +
          `fields=instagram_business_accounts{id,username,name,profile_picture_url,account_type}&` +
          `access_token=${longLivedToken}`
        );
        const bizData = await bizRes.json();

        for (const biz of (bizData.data || [])) {
          for (const igAcc of (biz.instagram_business_accounts?.data || [])) {
            if (!igAcc.username) continue;

            await supabase.from("connected_accounts").upsert({
              user_id: user.id,
              platform: "instagram",
              platform_user_id: igAcc.id,
              platform_username: igAcc.username,
              platform_name: igAcc.name || igAcc.username,
              avatar_url: igAcc.profile_picture_url || null,
              access_token: longLivedToken,
              token_expires_at: tokenExpiresAt,
              account_type: igAcc.account_type || "BUSINESS",
              permissions: ["instagram_basic"],
              is_active: true,
            }, {
              onConflict: "user_id,platform,platform_user_id",
            });

            accountSaved = true;
            console.log("✓ Saved IG account via Strategy C (businesses):", igAcc.username);
          }
        }
      } catch (strategyCErr) {
        console.error("Strategy C (businesses) failed:", strategyCErr);
      }
    }

    if (!accountSaved) {
      console.error("All strategies failed — no Instagram Business account found for this user.");
      return NextResponse.redirect(
        `${APP_URL}/connect?error=${encodeURIComponent("no_ig_business_account")}`
      );
    }

    return NextResponse.redirect(`${APP_URL}/connect?success=instagram`);
  } catch (err: any) {
    console.error("Instagram OAuth error:", err);
    return NextResponse.redirect(`${APP_URL}/connect?error=${encodeURIComponent(err.message)}`);
  }
}
