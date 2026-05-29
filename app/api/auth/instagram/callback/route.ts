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
    console.log("[IG] Token exchange:", JSON.stringify({ has_token: !!tokenData.access_token, error: tokenData.error }));

    if (!tokenData.access_token) throw new Error(tokenData.error?.message || "Token exchange failed");

    // ── Step 2: Long-lived user token (60 days) ──
    const llRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${META_APP_ID}&` +
      `client_secret=${META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const llData = await llRes.json();
    const userToken = llData.access_token || tokenData.access_token;
    const expiresIn = llData.expires_in || 5183944;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // ── Step 3: Debug — who is this user? what permissions? ──
    const [meRes, debugRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/me?fields=id,name,email&access_token=${userToken}`),
      fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${userToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`)
    ]);
    const meData = await meRes.json();
    const debugData = await debugRes.json();
    const grantedScopes: string[] = debugData.data?.scopes || [];
    console.log("[IG] User:", JSON.stringify({ id: meData.id, name: meData.name }));
    console.log("[IG] Granted scopes:", grantedScopes.join(", "));
    console.log("[IG] Has pages_show_list:", grantedScopes.includes("pages_show_list"));

    // ── Step 4: Supabase user ──
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${APP_URL}/?auth_required=1`);

    let accountSaved = false;

    // ── STRATEGY A: me/accounts (standard Pages approach) ──
    try {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?` +
        `fields=id,name,access_token,instagram_business_account&` +
        `access_token=${userToken}`
      );
      const pagesData = await pagesRes.json();
      console.log("[IG] Strategy A - me/accounts:", JSON.stringify(pagesData).substring(0, 500));

      for (const page of (pagesData.data || [])) {
        // Try with page token first, fall back to user token
        const tokenToUse = page.access_token || userToken;
        let igAccountId = page.instagram_business_account?.id;

        // If not in initial response, fetch via page token
        if (!igAccountId) {
          const pageDetailRes = await fetch(
            `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${tokenToUse}`
          );
          const pageDetail = await pageDetailRes.json();
          igAccountId = pageDetail.instagram_business_account?.id;
        }

        if (!igAccountId) { console.log("[IG] Strategy A - Page", page.name, "has no IG account"); continue; }

        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${igAccountId}?` +
          `fields=id,username,name,biography,followers_count,profile_picture_url,account_type&` +
          `access_token=${tokenToUse}`
        );
        const igData = await igRes.json();
        console.log("[IG] Strategy A - IG profile:", JSON.stringify(igData).substring(0, 300));
        if (!igData.username) continue;

        await supabase.from("connected_accounts").upsert({
          user_id: user.id, platform: "instagram",
          platform_user_id: igData.id, platform_username: igData.username,
          platform_name: igData.name || igData.username, avatar_url: igData.profile_picture_url || null,
          access_token: tokenToUse, token_expires_at: tokenExpiresAt,
          account_type: igData.account_type || "CREATOR",
          page_id: page.id, page_name: page.name,
          permissions: ["instagram_basic","instagram_manage_insights","instagram_content_publish","instagram_manage_messages","instagram_manage_comments"],
          is_active: true,
        }, { onConflict: "user_id,platform,platform_user_id" });

        accountSaved = true;
        console.log(`[IG] Strategy A ✓ Saved @${igData.username}`);
      }
    } catch (e: any) { console.error("[IG] Strategy A error:", e.message); }

    // ── STRATEGY B: me?fields=instagram_business_account (user's own IG) ──
    if (!accountSaved) {
      try {
        const meIgRes = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,name,instagram_business_account&access_token=${userToken}`
        );
        const meIgData = await meIgRes.json();
        console.log("[IG] Strategy B - me?instagram_business_account:", JSON.stringify(meIgData).substring(0, 300));

        const igId = meIgData.instagram_business_account?.id;
        if (igId) {
          const igRes = await fetch(
            `https://graph.facebook.com/v21.0/${igId}?fields=id,username,name,profile_picture_url,account_type&access_token=${userToken}`
          );
          const igData = await igRes.json();
          console.log("[IG] Strategy B - IG profile:", JSON.stringify(igData).substring(0, 300));

          if (igData.username) {
            await supabase.from("connected_accounts").upsert({
              user_id: user.id, platform: "instagram",
              platform_user_id: igData.id, platform_username: igData.username,
              platform_name: igData.name || igData.username, avatar_url: igData.profile_picture_url || null,
              access_token: userToken, token_expires_at: tokenExpiresAt,
              account_type: igData.account_type || "CREATOR",
              permissions: ["instagram_basic","instagram_manage_insights"],
              is_active: true,
            }, { onConflict: "user_id,platform,platform_user_id" });
            accountSaved = true;
            console.log(`[IG] Strategy B ✓ Saved @${igData.username}`);
          }
        }
      } catch (e: any) { console.error("[IG] Strategy B error:", e.message); }
    }

    // ── STRATEGY C: me/businesses (Business Manager linked accounts) ──
    if (!accountSaved) {
      try {
        const bizRes = await fetch(
          `https://graph.facebook.com/v21.0/me/businesses?` +
          `fields=id,name,instagram_business_accounts{id,username,name,profile_picture_url,account_type}&` +
          `access_token=${userToken}`
        );
        const bizData = await bizRes.json();
        console.log("[IG] Strategy C - me/businesses:", JSON.stringify(bizData).substring(0, 500));

        for (const biz of (bizData.data || [])) {
          for (const igAcc of (biz.instagram_business_accounts?.data || [])) {
            if (!igAcc.username) continue;
            await supabase.from("connected_accounts").upsert({
              user_id: user.id, platform: "instagram",
              platform_user_id: igAcc.id, platform_username: igAcc.username,
              platform_name: igAcc.name || igAcc.username, avatar_url: igAcc.profile_picture_url || null,
              access_token: userToken, token_expires_at: tokenExpiresAt,
              account_type: igAcc.account_type || "BUSINESS",
              permissions: ["instagram_basic"], is_active: true,
            }, { onConflict: "user_id,platform,platform_user_id" });
            accountSaved = true;
            console.log(`[IG] Strategy C ✓ Saved @${igAcc.username}`);
          }
        }
      } catch (e: any) { console.error("[IG] Strategy C error:", e.message); }
    }

    // ── STRATEGY D: Directly use user's own Instagram via basic display ──
    // Creator accounts are the authenticated user themselves
    if (!accountSaved && grantedScopes.includes("instagram_basic")) {
      try {
        // For Instagram creator accounts linked to Business Login,
        // the creator IS the authenticated user — try getting their IG data via /me
        const igMeRes = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,name,picture&access_token=${userToken}`
        );
        const igMeData = await igMeRes.json();
        console.log("[IG] Strategy D - /me basic:", JSON.stringify(igMeData).substring(0, 300));

        // Try fetching all Instagram accounts via the /me/instagram_accounts endpoint
        const igAccountsRes = await fetch(
          `https://graph.facebook.com/v21.0/me/instagram_accounts?fields=id,username,name,profile_picture_url,account_type&access_token=${userToken}`
        );
        const igAccountsData = await igAccountsRes.json();
        console.log("[IG] Strategy D - /me/instagram_accounts:", JSON.stringify(igAccountsData).substring(0, 500));

        for (const igAcc of (igAccountsData.data || [])) {
          if (!igAcc.username) continue;
          await supabase.from("connected_accounts").upsert({
            user_id: user.id, platform: "instagram",
            platform_user_id: igAcc.id, platform_username: igAcc.username,
            platform_name: igAcc.name || igAcc.username, avatar_url: igAcc.profile_picture_url || null,
            access_token: userToken, token_expires_at: tokenExpiresAt,
            account_type: igAcc.account_type || "CREATOR",
            permissions: ["instagram_basic"], is_active: true,
          }, { onConflict: "user_id,platform,platform_user_id" });
          accountSaved = true;
          console.log(`[IG] Strategy D ✓ Saved @${igAcc.username}`);
        }
      } catch (e: any) { console.error("[IG] Strategy D error:", e.message); }
    }

    if (!accountSaved) {
      console.error("[IG] ALL strategies failed. Scopes:", grantedScopes.join(","), "User:", meData.id);
      return NextResponse.redirect(`${APP_URL}/connect?error=no_ig_business_account`);
    }

    return NextResponse.redirect(`${APP_URL}/connect?success=instagram`);

  } catch (err: any) {
    console.error("[IG] Unhandled:", err.message);
    return NextResponse.redirect(`${APP_URL}/connect?error=${encodeURIComponent(err.message || "unknown")}`);
  }
}
