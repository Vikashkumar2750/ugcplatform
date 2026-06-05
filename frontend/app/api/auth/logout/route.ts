import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  // Clear admin session
  response.cookies.set("admin_session", "", { maxAge: 0, path: "/" });
  // Clear Supabase session if configured
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {}
  }
  return response;
}
