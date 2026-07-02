import { NextRequest, NextResponse } from "next/server";

const META_APP_ID = process.env.META_APP_ID!;
const META_APP_SECRET = process.env.META_APP_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_content_publish",
  "instagram_business_content_publish",
  "instagram_manage_messages",
  "instagram_manage_comments",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_messaging",
  "business_management",
].join(",");


// GET /api/auth/instagram — Redirect to Meta OAuth
export async function GET(request: NextRequest) {
  const redirectUri = `${APP_URL}/api/auth/instagram/callback`;

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", INSTAGRAM_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", generateState());

  return NextResponse.redirect(url.toString());
}

function generateState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
