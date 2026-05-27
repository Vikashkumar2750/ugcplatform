import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Read per-request so env changes in dev are picked up
function getAdminEmail() {
  return (process.env.ADMIN_EMAIL || "admin@techaasvik.in").toLowerCase().trim();
}

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/pricing",
  "/privacy",
  "/terms",
  "/api/leads",
  "/api/admin",
  "/api/payments",
  "/api/webhooks",
  "/api/auth",
  "/api/connect",
  "/docs",
  "/data-deletion-status",
];

function isAdminSessionValid(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  try {
    const dotIdx = cookieValue.lastIndexOf(".");
    if (dotIdx === -1) return false;
    const payloadB64 = cookieValue.substring(0, dotIdx);
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64").toString("utf-8")
    );
    if (!payload || typeof payload !== "object") return false;
    if (payload.role !== "admin") return false;
    if (!payload.email || !payload.ts) return false;
    const emailMatch = payload.email.toLowerCase().trim() === getAdminEmail();
    const isExpired = Date.now() - payload.ts > 7 * 24 * 60 * 60 * 1000;
    return emailMatch && !isExpired;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Always allow public routes — no auth needed
  const isPublic = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
  if (isPublic) return NextResponse.next({ request });

  // 2. Check admin session cookie
  const adminCookie = request.cookies.get("admin_session")?.value;
  const adminValid = isAdminSessionValid(adminCookie);

  // 3. Admin-only routes: /admin/*
  if (pathname.startsWith("/admin")) {
    if (!adminValid) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "admin_required");
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  // 4. Admin can also browse user routes (for UX testing)
  if (adminValid) return NextResponse.next({ request });

  // 5. Regular user routes — always require Supabase session
  //    Even in dev mode: if you're not logged in, go to /login
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Supabase not configured → no way to authenticate regular users
    // Redirect to login so the form is shown
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "auth_required");
    return NextResponse.redirect(url);
  }

  // 6. Supabase configured — validate session
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "auth_required");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
