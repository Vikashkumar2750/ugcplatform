import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ── Token generation (used by webhook to create gate URLs) ──
// Token format: base64({ ruleId, username, link, message, buttonLabel, ts })
// Signed with HMAC to prevent tampering
const GATE_SECRET = process.env.META_APP_SECRET || "gate_fallback_secret";

export function createGateToken(data: {
  ruleId: string;
  username: string;
  link: string;
  message?: string;
  buttonLabel?: string;
}): string {
  const payload = JSON.stringify({ ...data, ts: Date.now() });
  const sig = crypto.createHmac("sha256", GATE_SECRET).update(payload).digest("hex").substring(0, 12);
  return Buffer.from(`${sig}:${payload}`).toString("base64url");
}

export function verifyGateToken(token: string): {
  ruleId: string;
  username: string;
  link: string;
  message?: string;
  buttonLabel?: string;
  ts: number;
} | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx < 0) return null;
    const sig = decoded.substring(0, colonIdx);
    const payload = decoded.substring(colonIdx + 1);
    const expectedSig = crypto.createHmac("sha256", GATE_SECRET).update(payload).digest("hex").substring(0, 12);
    if (sig !== expectedSig) return null;
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// ── GET /api/gate/[token] — returns gate data for the landing page ──
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const data = verifyGateToken(token);
  if (!data) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
  }

  // Token is valid — return the gate data for the landing page
  // (link is included so the page can reveal it after user "confirms" follow)
  return NextResponse.json({
    username: data.username,
    link: data.link,
    message: data.message || "",
    buttonLabel: data.buttonLabel || "Get Access →",
  });
}
