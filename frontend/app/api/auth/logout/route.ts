import { NextRequest, NextResponse } from "next/server";

// Supabase SSR cookie names follow pattern: sb-{ref}-auth-token*
const SUPABASE_COOKIE_PATTERN = /^sb-.*-auth-token/;

function clearAllAuthCookies(response: NextResponse, request: NextRequest) {
  // Clear admin session
  response.cookies.set("admin_session", "", { maxAge: 0, path: "/" });

  // Clear ALL Supabase auth cookies
  const allCookies = request.cookies.getAll();
  for (const cookie of allCookies) {
    if (SUPABASE_COOKIE_PATTERN.test(cookie.name)) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }

  return response;
}

// POST /api/auth/logout (called from sidebar)
export async function POST(req: NextRequest) {
  // Server-side signout
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {}
  }

  const response = NextResponse.json({ success: true });
  return clearAllAuthCookies(response, req);
}

// GET /api/auth/logout (called from settings page <a> tag)
export async function GET(req: NextRequest) {
  // Server-side signout
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {}
  }

  // Redirect to login after clearing cookies
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("reason", "logged_out");

  const response = NextResponse.redirect(url);
  return clearAllAuthCookies(response, req);
}
