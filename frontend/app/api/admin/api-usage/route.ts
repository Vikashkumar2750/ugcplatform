import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  // Only allow admin
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET_KEY}`) {
    // Also allow via supabase admin role
    const { createClient: createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check if admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const supabase = getServiceClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Fetch API usage logs grouped by provider
  const { data: logs } = await supabase
    .from("api_usage_logs")
    .select("provider, model, tokens_used, created_at, success")
    .gte("created_at", monthStart)
    .order("created_at", { ascending: false });

  const usage: Record<string, { today: number; month: number; todayTokens: number; monthTokens: number; errors: number }> = {};

  for (const log of (logs || [])) {
    const p = log.provider || "unknown";
    if (!usage[p]) usage[p] = { today: 0, month: 0, todayTokens: 0, monthTokens: 0, errors: 0 };
    usage[p].month++;
    usage[p].monthTokens += log.tokens_used || 0;
    if (!log.success) usage[p].errors++;
    if (log.created_at >= todayStart) {
      usage[p].today++;
      usage[p].todayTokens += log.tokens_used || 0;
    }
  }

  // Define limits per provider
  const limits: Record<string, { dailyRequests: number; monthlyTokens: number; label: string; color: string }> = {
    gemini: { dailyRequests: 1500, monthlyTokens: 1000000, label: "Google Gemini", color: "blue" },
    bedrock: { dailyRequests: 500, monthlyTokens: 500000, label: "AWS Bedrock", color: "orange" },
    anthropic: { dailyRequests: 200, monthlyTokens: 200000, label: "Claude (Anthropic)", color: "purple" },
    openai: { dailyRequests: 200, monthlyTokens: 500000, label: "OpenAI", color: "green" },
  };

  const result = Object.entries(limits).map(([id, limit]) => ({
    id,
    label: limit.label,
    color: limit.color,
    dailyRequests: usage[id]?.today || 0,
    dailyLimit: limit.dailyRequests,
    dailyPct: Math.min(100, Math.round(((usage[id]?.today || 0) / limit.dailyRequests) * 100)),
    monthlyTokens: usage[id]?.monthTokens || 0,
    monthlyTokenLimit: limit.monthlyTokens,
    monthlyPct: Math.min(100, Math.round(((usage[id]?.monthTokens || 0) / limit.monthlyTokens) * 100)),
    totalMonth: usage[id]?.month || 0,
    errors: usage[id]?.errors || 0,
  }));

  // Meta Graph API — from webhook_events
  const { count: metaToday } = await supabase
    .from("webhook_events")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart);

  const { count: metaMonth } = await supabase
    .from("webhook_events")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthStart);

  return NextResponse.json({
    providers: result,
    meta: {
      label: "Meta Graph API",
      color: "blue",
      webhooksToday: metaToday || 0,
      webhooksMonth: metaMonth || 0,
      hourlyLimit: 200,
    },
    totalMonth: Object.values(usage).reduce((sum, u) => sum + u.month, 0),
  });
}
