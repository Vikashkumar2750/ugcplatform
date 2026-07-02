import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/automation/analytics
export async function GET(request: NextRequest) {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "7d";

  const now = new Date();
  const since = new Date();
  if (period === "today") since.setHours(0, 0, 0, 0);
  else if (period === "7d") since.setDate(now.getDate() - 7);
  else since.setDate(now.getDate() - 30);

  const sinceStr = since.toISOString();

  // Fetch rule stats
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("id, name, type, is_active, trigger_count, last_triggered")
    .eq("user_id", user.id)
    .order("trigger_count", { ascending: false });

  const allRules = rules || [];
  const totalRules = allRules.length;
  const activeRules = allRules.filter(r => r.is_active).length;
  const totalTriggers = allRules.reduce((sum, r) => sum + (r.trigger_count || 0), 0);

  // Queue stats
  const { count: sentCount } = await supabase
    .from("message_queue")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "sent")
    .gte("created_at", sinceStr);

  const { count: blockedCount } = await supabase
    .from("compliance_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("decision", "blocked")
    .gte("created_at", sinceStr);

  // AI confidence average
  const { data: aiReviews } = await supabase
    .from("human_review_queue")
    .select("ai_confidence")
    .eq("user_id", user.id)
    .gte("created_at", sinceStr);

  const avgConfidence = aiReviews?.length
    ? Math.round(aiReviews.reduce((sum, r) => sum + (r.ai_confidence || 0), 0) / aiReviews.length)
    : 85; // Default when no AI data

  // Top rules
  const topRules = allRules.slice(0, 5).map(r => ({
    name: r.name,
    triggers: r.trigger_count || 0,
    type: r.type,
  }));

  // Hourly activity (last 24h) — simplified
  const hourlyActivity = Array(24).fill(0);
  const { data: recentSent } = await supabase
    .from("message_queue")
    .select("sent_at")
    .eq("user_id", user.id)
    .eq("status", "sent")
    .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  (recentSent || []).forEach(msg => {
    if (msg.sent_at) {
      const hour = new Date(msg.sent_at).getHours();
      hourlyActivity[hour]++;
    }
  });

  return NextResponse.json({
    totalRules,
    activeRules,
    totalTriggers,
    totalSent: sentCount || 0,
    totalBlocked: blockedCount || 0,
    avgConfidence,
    topRules,
    hourlyActivity,
    recentActivity: [],
  });
}
