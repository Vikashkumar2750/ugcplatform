import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, getAdminSupabase } from "@/lib/admin-auth";

const DEMO_STATS = {
  demo: true,
  totalUsers: 0,
  activeSubscriptions: 0,
  freeUsers: 0,
  bannedUsers: 0,
  mrr: 0,
  totalRevenue: 0,
  totalAnalyses: 0,
  totalScripts: 0,
  openTickets: 0,
  avgSessionMin: 0,
  platformBreakdown: { instagram: 0, youtube: 0, facebook: 0 },
  connectedAccounts: { instagram: 0, youtube: 0, facebook: 0 },
  recentActivity: [] as any[],
  planBreakdown: { lifetime: 0, monthly: 0, yearly: 0, free: 0 },
};

export async function GET(req: NextRequest) {
  const authErr = requireAdminApi(req);
  if (authErr) return authErr;

  const supabase = await getAdminSupabase();
  if (!supabase) {
    return NextResponse.json(DEMO_STATS);
  }

  try {
    // --- Users ---
    const { data: users, error: uErr } = await supabase
      .from("user_profiles")
      .select("id, platform, niche, status, created_at");

    const { data: subs } = await supabase
      .from("user_subscriptions")
      .select("user_id, plan_type, status");

    const { data: txns } = await supabase
      .from("transactions")
      .select("amount, type, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("id, status, created_at, subject, user_email")
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: analyses } = await supabase
      .from("analysis_results")
      .select("id");

    const { data: connections } = await supabase
      .from("platform_connections")
      .select("platform, user_id");

    // --- Compute ---
    const totalUsers = users?.length || 0;
    const planMap = Object.fromEntries((subs || []).map(s => [s.user_id, s.plan_type]));
    const planBreakdown = { lifetime: 0, monthly: 0, yearly: 0, free: 0 } as Record<string, number>;
    (subs || []).forEach(s => { if (planBreakdown[s.plan_type] !== undefined) planBreakdown[s.plan_type]++; });

    const activeSubscriptions = (subs || []).filter(s => s.status === "active" && s.plan_type !== "free").length;
    const bannedUsers = (users || []).filter(u => u.status === "banned").length;

    const successTxns = (txns || []).filter(t => t.status === "success" && t.type === "payment");
    const totalRevenue = successTxns.reduce((a, b) => a + (b.amount || 0), 0);

    const openTickets = (tickets || []).filter(t => t.status === "open" || t.status === "in_progress").length;

    const platformBreakdown = { instagram: 0, youtube: 0, facebook: 0 } as Record<string, number>;
    const connectedAccounts = { instagram: 0, youtube: 0, facebook: 0 } as Record<string, number>;
    (users || []).forEach(u => { if (platformBreakdown[u.platform]) platformBreakdown[u.platform]++; });
    (connections || []).forEach(c => { if (connectedAccounts[c.platform] !== undefined) connectedAccounts[c.platform]++; });

    const recentActivity = (tickets || []).slice(0, 10).map(t => ({
      type: "ticket", user: t.user_email, detail: t.subject, time: t.created_at, status: t.status
    }));

    return NextResponse.json({
      demo: false,
      totalUsers,
      activeSubscriptions,
      freeUsers: planBreakdown.free,
      bannedUsers,
      mrr: planBreakdown.monthly * 49 + planBreakdown.yearly * (399 / 12),
      totalRevenue,
      totalAnalyses: analyses?.length || 0,
      totalScripts: 0,
      openTickets,
      avgSessionMin: 0,
      platformBreakdown,
      connectedAccounts,
      recentActivity,
      planBreakdown,
    });
  } catch (e: any) {
    console.error("[/api/admin/stats]", e);
    return NextResponse.json(DEMO_STATS);
  }
}
