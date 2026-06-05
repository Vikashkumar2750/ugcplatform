import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, getAdminSupabase } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authErr = requireAdminApi(req);
  if (authErr) return authErr;

  const supabase = await getAdminSupabase();
  if (!supabase) return NextResponse.json({ demo: true, transactions: [] });

  try {
    const { data: txns } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name");

    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const emailMap = Object.fromEntries((authUsers?.users || []).map(u => [u.id, u.email]));
    const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));

    const transactions = (txns || []).map(t => ({
      ...t,
      userName: nameMap[t.user_id] || "Unknown",
      userEmail: emailMap[t.user_id] || "—",
    }));

    const gross = transactions.filter(t => t.status === "success" && t.type === "payment").reduce((a, b) => a + (b.amount || 0), 0);
    const refunds = transactions.filter(t => t.type === "refund").reduce((a, b) => a + (b.amount || 0), 0);

    return NextResponse.json({
      demo: false,
      transactions,
      summary: { gross, refunds, net: gross - Math.abs(refunds), count: transactions.length }
    });
  } catch (e: any) {
    return NextResponse.json({ demo: true, transactions: [], summary: { gross: 0, refunds: 0, net: 0, count: 0 } });
  }
}
