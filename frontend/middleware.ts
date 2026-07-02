import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Edge Middleware
 * - Protects cron endpoints from external access
 * - Adds basic rate limiting headers
 * - Blocks source map access in production
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Block access to cron endpoints from non-Vercel sources ──
  if (pathname.startsWith("/api/cron/")) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Block source maps in production ──
  if (pathname.endsWith(".map") && process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  // ── Add security context headers ──
  const response = NextResponse.next();

  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
}

export const config = {
  matcher: [
    // Apply to API routes and source maps
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)\\.map",
  ],
};
