import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const state = searchParams.get("state") || "";

  if (error || !code) {
    console.error("LinkedIn OAuth error:", error, errorDescription);
    return NextResponse.redirect(`${APP_URL}/connect?error=oauth_denied`);
  }

  // Parse type from state (e.g. "linkedin_profile_XYZ" or "linkedin_page_XYZ")
  const type = state.split("_")[1] || "profile";
  
  let clientId = "";
  let clientSecret = "";

  if (type === "page") {
    clientId = process.env.LINKEDIN_PAGE_CLIENT_ID!;
    clientSecret = process.env.LINKEDIN_PAGE_CLIENT_SECRET!;
  } else {
    clientId = process.env.LINKEDIN_PROFILE_CLIENT_ID!;
    clientSecret = process.env.LINKEDIN_PROFILE_CLIENT_SECRET!;
  }

  try {
    const redirectUri = `${APP_URL}/api/auth/linkedin/callback`;

    // 1. Exchange code for token
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    
    if (!tokenData.access_token) {
      console.error("LinkedIn Token Error:", tokenData);
      throw new Error("Failed to exchange code for token");
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token; // May not be returned if not configured
    const expiresIn = tokenData.expires_in || 5184000; // 60 days default
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${APP_URL}/?auth_required=1`);

    if (type === "profile") {
      // Fetch Profile Data using OpenID Connect endpoint
      const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const profileData = await profileRes.json();

      if (!profileData.sub) {
        throw new Error("Could not fetch LinkedIn profile data");
      }

      await supabase.from("connected_accounts").upsert({
        user_id: user.id,
        platform: "linkedin",
        platform_user_id: `urn:li:person:${profileData.sub}`,
        platform_username: profileData.name || profileData.given_name,
        platform_name: profileData.name || profileData.given_name,
        avatar_url: profileData.picture || null,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        account_type: "PROFILE",
        permissions: ["w_member_social"],
        is_active: true,
      }, {
        onConflict: "user_id,platform,platform_user_id",
      });
      
      return NextResponse.redirect(`${APP_URL}/connect?success=linkedin_profile`);

    } else if (type === "page") {
      // Fetch User's Pages
      const orgsRes = await fetch("https://api.linkedin.com/rest/organizations?q=roleAssignee&role=ADMINISTRATOR", {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": "2024-01" 
        }
      });
      const orgsData = await orgsRes.json();

      if (!orgsData.elements || orgsData.elements.length === 0) {
        throw new Error("No LinkedIn Company Pages found where you are an admin.");
      }

      // We need to fetch the localized name and logo for each organization
      for (const org of orgsData.elements) {
        const orgId = org.organizationalTarget; // e.g., urn:li:organization:123456
        
        const detailsRes = await fetch(`https://api.linkedin.com/rest/organizations/${orgId.replace('urn:li:organization:', '')}?projection=(id,localizedName,logoV2(original~:playableStreams))`, {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            "LinkedIn-Version": "2024-01" 
          }
        });
        const details = await detailsRes.json();
        
        let logoUrl = null;
        if (details.logoV2 && details.logoV2["original~"] && details.logoV2["original~"].elements && details.logoV2["original~"].elements.length > 0) {
           logoUrl = details.logoV2["original~"].elements[0].identifiers[0].identifier;
        }

        await supabase.from("connected_accounts").upsert({
          user_id: user.id,
          platform: "linkedin",
          platform_user_id: orgId,
          page_id: orgId,
          platform_name: details.localizedName || "Company Page",
          platform_username: details.localizedName || "Company Page",
          avatar_url: logoUrl,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: tokenExpiresAt,
          account_type: "PAGE",
          permissions: ["w_organization_social"],
          is_active: true,
        }, {
          onConflict: "user_id,platform,platform_user_id",
        });
      }

      return NextResponse.redirect(`${APP_URL}/connect?success=linkedin_page`);
    }

  } catch (err: any) {
    console.error("LinkedIn OAuth error:", err);
    return NextResponse.redirect(`${APP_URL}/connect?error=${encodeURIComponent(err.message)}`);
  }
}
