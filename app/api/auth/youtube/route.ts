import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

// GET /api/auth/youtube — Redirect to Google OAuth
export async function GET(request: NextRequest) {
  const redirectUri = `${APP_URL}/api/auth/youtube/callback`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", YOUTUBE_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline"); // Gets refresh token
  url.searchParams.set("prompt", "consent");       // Force refresh token every time
  url.searchParams.set("state", "youtube_" + Math.random().toString(36).substring(2, 15));

  return NextResponse.redirect(url.toString());
}
