import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function getAdminEmail() {
  return (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
}

export function isAdminCookieValid(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  try {
    const dotIdx = cookieValue.lastIndexOf(".");
    if (dotIdx === -1) return false;
    const payloadB64 = cookieValue.substring(0, dotIdx);
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf-8"));
    if (!payload?.email || !payload?.ts || payload.role !== "admin") return false;
    const emailMatch = payload.email.toLowerCase().trim() === getAdminEmail();
    const isExpired = Date.now() - payload.ts > 7 * 24 * 60 * 60 * 1000;
    return emailMatch && !isExpired;
  } catch { return false; }
}

/** Use in server components / page.tsx */
export async function requireAdmin() {
  const cookieStore = await cookies();
  const val = cookieStore.get("admin_session")?.value;
  if (!isAdminCookieValid(val)) return false;
  return true;
}

/** Use in API route handlers */
export function requireAdminApi(req: NextRequest): NextResponse | null {
  const val = req.cookies.get("admin_session")?.value;
  if (!isAdminCookieValid(val)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null; // null = auth ok
}

/** Return Supabase service client (server-side, bypasses RLS) */
export async function getAdminSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
