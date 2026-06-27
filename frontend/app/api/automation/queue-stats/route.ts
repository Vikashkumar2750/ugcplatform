import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAuthUser(request: NextRequest) {
  const supabase = getServiceClient();
  // Try to get user from Supabase cookies
  const { createClient: createServerClient } = await import("@/lib/supabase/server");
  const serverSupabase = await createServerClient();
  const { data: { user } } = await serverSupabase.auth.getUser();
  return user;
}

// GET /api/automation/queue-stats
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();

  // Count messages by status for this user
  const statuses = ["queued", "ready", "processing", "sent", "failed", "blocked"];
  const counts: Record<string, number> = {};

  for (const status of statuses) {
    const { count } = await supabase
      .from("message_queue")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", status);
    counts[status] = count || 0;
  }

  return NextResponse.json(counts);
}
