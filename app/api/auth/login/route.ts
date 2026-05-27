import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@techaasvik.in";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin@123";
const SESSION_SECRET = process.env.SESSION_SECRET || "contentiq_super_secret_2025_techaasvik";

function signToken(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // --- Super Admin check (env-based, no DB needed) ---
    if (
      email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim() &&
      password === ADMIN_PASSWORD
    ) {
      const payload = `admin:${email}:${Date.now()}`;
      const signature = signToken(payload);
      const token =
        Buffer.from(JSON.stringify({ email: email.toLowerCase().trim(), role: "admin", ts: Date.now() })).toString("base64") +
        "." +
        signature;

      const response = NextResponse.json({ role: "admin", success: true });
      response.cookies.set("admin_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });
      return response;
    }

    // If the email matches admin but password is wrong — reject immediately
    if (email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) {
      return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
    }

    // --- Normal User via Supabase ---
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      // Supabase not configured — cannot authenticate regular users in this env
      return NextResponse.json(
        { error: "User authentication not configured yet. Please contact admin." },
        { status: 503 }
      );
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    return NextResponse.json({ role: "user", success: true });
  } catch (err: any) {
    console.error("[/api/auth/login]", err);
    return NextResponse.json({ error: "Login failed. Try again." }, { status: 500 });
  }
}
