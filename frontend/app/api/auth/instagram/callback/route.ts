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

    // ── Step 1: Exchange code → short-lived token ──
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error(tokenData.error?.message || "Token exchange failed");

    // ── Step 2: Long-lived token (60 days) ──
    const llRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${META_APP_ID}&` +
      `client_secret=${META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const llData = await llRes.json();
    const userToken = llData.access_token || tokenData.access_token;
    const expiresIn = llData.expires_in || 5183944;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // ── Step 3: Debug token to get scopes and token type ──
    const debugRes = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${userToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`
    );
    const debugData = await debugRes.json();
    const grantedScopes: string[] = debugData.data?.scopes || [];
    const tokenType = debugData.data?.type || "unknown";
    const appScopedUserId = debugData.data?.user_id || "";
    console.log("[IG] Token type:", tokenType, "| App scoped user ID:", appScopedUserId);
    console.log("[IG] Granted scopes:", grantedScopes.join(", "));

    // ── Step 4: Call /me — get FB user info ──
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,picture,instagram_business_account&access_token=${userToken}`
    );
    const meData = await meRes.json();
    console.log("[IG] /me response:", JSON.stringify(meData).substring(0, 500));

    // Also try to get picture separately if needed
    const avatarUrl = meData.picture?.data?.url || null;

    // ── Step 5: Supabase user ──
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${APP_URL}/?auth_required=1`);

    let accountSaved = false;

    // ── STRATEGY 0: /me IS already an Instagram user (username field present) ──
    // This happens with Instagram Business Login token (not FB user token)
    if (!accountSaved && meData.username) {
      console.log("[IG] Strategy 0: /me has username directly →", meData.username);
      const { error: upsertErr } = await supabase.from("connected_accounts").upsert({
        user_id: user.id, platform: "instagram",
        platform_user_id: meData.id,
        platform_username: meData.username,
        platform_name: meData.name || meData.username,
        avatar_url: meData.profile_picture_url || null,
        access_token: userToken, token_expires_at: tokenExpiresAt,
        account_type: meData.account_type || "CREATOR",
        permissions: grantedScopes,
        is_active: true,
      }, { onConflict: "user_id,platform,platform_user_id" });
      if (!upsertErr) { accountSaved = true; console.log("[IG] Strategy 0 ✓ @" + meData.username); }
      else console.error("[IG] Strategy 0 DB error:", upsertErr.message);
    }

    // ── STRATEGY 1: /me has instagram_business_account (FB token with linked IG) ──
    if (!accountSaved && meData.instagram_business_account?.id) {
      console.log("[IG] Strategy 1: /me has instagram_business_account →", meData.instagram_business_account.id);
      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/${meData.instagram_business_account.id}?` +
        `fields=id,username,name,profile_picture_url,account_type,followers_count&` +
        `access_token=${userToken}`
      );
      const igData = await igRes.json();
      console.log("[IG] Strategy 1 IG data:", JSON.stringify(igData).substring(0, 300));
      if (igData.username) {
        const { error: upsertErr } = await supabase.from("connected_accounts").upsert({
          user_id: user.id, platform: "instagram",
          platform_user_id: igData.id, platform_username: igData.username,
          platform_name: igData.name || igData.username, avatar_url: igData.profile_picture_url || null,
          access_token: userToken, token_expires_at: tokenExpiresAt,
          account_type: igData.account_type || "CREATOR",
          permissions: grantedScopes, is_active: true,
        }, { onConflict: "user_id,platform,platform_user_id" });
        if (!upsertErr) { accountSaved = true; console.log("[IG] Strategy 1 ✓ @" + igData.username); }
        else console.error("[IG] Strategy 1 DB error:", upsertErr.message);
      }
    }

    // ── STRATEGY 2: me/accounts with Page tokens (standard Pages approach) ──
    if (!accountSaved) {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${userToken}`
      );
      const pagesData = await pagesRes.json();
      console.log("[IG] Strategy 2 me/accounts:", JSON.stringify(pagesData).substring(0, 300));

      for (const page of (pagesData.data || [])) {
        const pageToken = page.access_token || userToken;
        const pageDetailRes = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${pageToken}`
        );
        const pageDetail = await pageDetailRes.json();
        const igId = pageDetail.instagram_business_account?.id;
        console.log("[IG] Strategy 2 Page", page.name, "→ IG:", igId || "none");
        if (!igId) continue;

        // Fetch IG profile — ONLY use guaranteed basic fields (others are restricted in dev mode)
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${igId}?fields=id,username,name&access_token=${pageToken}`
        );
        const igData = await igRes.json();
        console.log("[IG] Strategy 2 IG profile:", JSON.stringify(igData).substring(0, 300));

        if (!igData.username) {
          console.error("[IG] Strategy 2 IG fetch failed or no username:", JSON.stringify(igData));
          continue;
        }

        // Fetch profile picture separately (optional — don't fail if missing)
        let avatarUrl: string | null = null;
        try {
          const picRes = await fetch(
            `https://graph.facebook.com/v21.0/${igId}?fields=profile_picture_url&access_token=${pageToken}`
          );
          const picData = await picRes.json();
          avatarUrl = picData.profile_picture_url || null;
        } catch (_) {}

        const { error: upsertErr } = await supabase.from("connected_accounts").upsert({
          user_id: user.id, platform: "instagram",
          platform_user_id: igData.id, platform_username: igData.username,
          platform_name: igData.name || igData.username,
          avatar_url: avatarUrl,
          access_token: pageToken, token_expires_at: tokenExpiresAt,
          account_type: igData.account_type || "CREATOR",
          page_id: page.id, page_name: page.name,
          permissions: grantedScopes, is_active: true,
        }, { onConflict: "user_id,platform,platform_user_id" });

        if (upsertErr) {
          console.error("[IG] Strategy 2 DB upsert error:", upsertErr.message, upsertErr.details);
          continue;
        }

        accountSaved = true;
        console.log("[IG] Strategy 2 ✓ Saved @" + igData.username);

        // ── CRITICAL: Subscribe page to webhooks so Meta sends events ──
        // Without this, Meta never fires comment/DM webhooks!
        // Try full fields first, fallback to messages-only if permissions missing
        const fieldSets = [
          "feed,messages,messaging_postbacks,mention",
          "messages,messaging_postbacks",
        ];
        for (const fields of fieldSets) {
          try {
            const subRes = await fetch(
              `https://graph.facebook.com/v21.0/${page.id}/subscribed_apps`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  subscribed_fields: fields,
                  access_token: pageToken,
                }),
              }
            );
            const subData = await subRes.json();
            if (subData.success) {
              console.log(`[IG] ✅ Page ${page.name} subscribed to webhooks (fields: ${fields})`);
              break;
            } else {
              console.warn(`[IG] ⚠️ Subscription with "${fields}" failed: ${subData.error?.message}`);
            }
          } catch (subErr: any) {
            console.error(`[IG] ❌ Webhook subscription error:`, subErr.message);
          }
        }
      }
    }

    // -- STRATEGY 2B: me/businesses (Business Manager route) --
    if (!accountSaved) {
      try {
        const bizRes = await fetch(
          `https://graph.facebook.com/v21.0/me/businesses?` +
          `fields=id,name,owned_instagram_accounts{id,username,name,profile_picture_url,account_type},instagram_business_accounts{id,username,name,profile_picture_url,account_type}&` +
          `access_token=${userToken}`
        );
        const bizData = await bizRes.json();
        console.log("[IG] Strategy 2B me/businesses:", JSON.stringify(bizData).substring(0, 500));
        for (const biz of (bizData.data || [])) {
          const igAccounts = [
            ...(biz.owned_instagram_accounts?.data || []),
            ...(biz.instagram_business_accounts?.data || []),
          ];
          for (const igAcc of igAccounts) {
            if (!igAcc.username) continue;
            await supabase.from("connected_accounts").upsert({
              user_id: user.id, platform: "instagram",
              platform_user_id: igAcc.id, platform_username: igAcc.username,
              platform_name: igAcc.name || igAcc.username, avatar_url: igAcc.profile_picture_url || null,
              access_token: userToken, token_expires_at: tokenExpiresAt,
              account_type: igAcc.account_type || "CREATOR", permissions: grantedScopes, is_active: true,
            }, { onConflict: "user_id,platform,platform_user_id" });
            accountSaved = true;
            console.log("[IG] Strategy 2B + @" + igAcc.username);
          }
        }
      } catch (e: any) { console.error("[IG] Strategy 2B error:", e.message); }
    }

    // ── STRATEGY 3: me/instagram_accounts (direct IG account list) ──
    if (!accountSaved) {
      const igListRes = await fetch(
        `https://graph.facebook.com/v21.0/me/instagram_accounts?fields=id,username,name&access_token=${userToken}`
      );
      const igListData = await igListRes.json();
      console.log("[IG] Strategy 3 me/instagram_accounts:", JSON.stringify(igListData).substring(0, 400));
      for (const igAcc of (igListData.data || [])) {
        if (!igAcc.username) continue;
        await supabase.from("connected_accounts").upsert({
          user_id: user.id, platform: "instagram",
          platform_user_id: igAcc.id, platform_username: igAcc.username,
          platform_name: igAcc.name || igAcc.username, avatar_url: igAcc.profile_picture_url || null,
          access_token: userToken, token_expires_at: tokenExpiresAt,
          account_type: igAcc.account_type || "CREATOR", permissions: grantedScopes, is_active: true,
        }, { onConflict: "user_id,platform,platform_user_id" });
        accountSaved = true;
        console.log("[IG] Strategy 3 ✓ @" + igAcc.username);
      }
    }

    // ── STRATEGY 4: Use the app-scoped user ID directly as IG account ID ──
    // For Instagram Business Login tokens, the user_id from debug_token IS the IG account ID
    if (!accountSaved && appScopedUserId && tokenType === "USER") {
      console.log("[IG] Strategy 4: Trying app_scoped_user_id as IG account →", appScopedUserId);
      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/${appScopedUserId}?fields=id,username,name&access_token=${userToken}`
      );
      const igData = await igRes.json();
      console.log("[IG] Strategy 4 result:", JSON.stringify(igData).substring(0, 300));
      if (igData.username) {
        await supabase.from("connected_accounts").upsert({
          user_id: user.id, platform: "instagram",
          platform_user_id: igData.id, platform_username: igData.username,
          platform_name: igData.name || igData.username, avatar_url: igData.profile_picture_url || null,
          access_token: userToken, token_expires_at: tokenExpiresAt,
          account_type: igData.account_type || "CREATOR", permissions: grantedScopes, is_active: true,
        }, { onConflict: "user_id,platform,platform_user_id" });
        accountSaved = true;
        console.log("[IG] Strategy 4 ✓ @" + igData.username);
      }
    }

    if (!accountSaved) {
      console.error("[IG] ALL strategies failed. Scopes:", grantedScopes.join(","));
      console.error("[IG] /me data:", JSON.stringify(meData));
      return NextResponse.redirect(`${APP_URL}/connect?error=no_ig_business_account`);
    }

    return NextResponse.redirect(`${APP_URL}/connect?success=instagram`);

  } catch (err: any) {
    console.error("[IG] Unhandled:", err.message);
    return NextResponse.redirect(`${APP_URL}/connect?error=${encodeURIComponent(err.message || "unknown")}`);
  }
}
