import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "profile";

  const redirectUri = `${APP_URL}/api/auth/linkedin/callback`;

  let clientId = "";
  let scopes = "";

  if (type === "page") {
    clientId = process.env.LINKEDIN_PAGE_CLIENT_ID!;
    // Note: Community Management API requires these scopes for managing pages.
    scopes = "r_organization_social w_organization_social rw_organization_admin r_organization_admin";
  } else {
    clientId = process.env.LINKEDIN_PROFILE_CLIENT_ID!;
    scopes = "openid profile email w_member_social";
  }

  const state = `linkedin_${type}_${Math.random().toString(36).substring(2, 15)}`;

  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", scopes);

  return NextResponse.redirect(url.toString());
}
