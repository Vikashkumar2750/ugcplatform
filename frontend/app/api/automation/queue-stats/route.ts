import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/automation/queue-stats
export async function GET(request: NextRequest) {
  const supabase = getServiceClient();

  // Count messages by status
  const statuses = ["queued", "ready", "processing", "sent", "failed", "blocked"];
  const counts: Record<string, number> = {};

  for (const status of statuses) {
    const { count } = await supabase
      .from("message_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", status);
    counts[status] = count || 0;
  }

  return NextResponse.json(counts);
}
