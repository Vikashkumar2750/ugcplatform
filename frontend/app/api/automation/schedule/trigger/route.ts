import { NextResponse } from "next/server";

/**
 * POST /api/automation/schedule/trigger
 * Triggers the backend to immediately process any pending scheduled posts.
 * Fire-and-forget — the cron is the fallback if this fails.
 */
export async function POST() {
  const BACKEND_URL = process.env.RENDER_WORKER_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
  const WORKER_SECRET = process.env.WORKER_SECRET || "";

  try {
    const res = await fetch(`${BACKEND_URL}/trigger/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": WORKER_SECRET,
      },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    // Non-critical — cron will pick it up within 15s
    return NextResponse.json({ triggered: false, error: err.message });
  }
}
