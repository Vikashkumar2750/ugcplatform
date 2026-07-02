import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, getAdminSupabase } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authErr = requireAdminApi(req);
  if (authErr) return authErr;

  const supabase = await getAdminSupabase();
  if (!supabase) return NextResponse.json({ demo: true, users: [] });

  try {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name, whatsapp, platform, niche, status, created_at, api_keys_set")
      .order("created_at", { ascending: false });

    const { data: subs } = await supabase
      .from("user_subscriptions")
      .select("user_id, plan_type, status, current_period_end, razorpay_subscription_id");

    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const emailMap = Object.fromEntries(
      (authUsers?.users || []).map(u => [u.id, u.email])
    );

    const subMap = Object.fromEntries(
      (subs || []).map(s => [s.user_id, s])
    );

    // Connected accounts (multi-account aware)
    const { data: connections } = await supabase
      .from("connected_accounts")
      .select("user_id, platform")
      .eq("is_active", true);

    const connMap: Record<string, string[]> = {};
    const connCount: Record<string, number> = {};
    (connections || []).forEach(c => {
      if (!connMap[c.user_id]) connMap[c.user_id] = [];
      if (!connMap[c.user_id].includes(c.platform)) connMap[c.user_id].push(c.platform);
      connCount[c.user_id] = (connCount[c.user_id] || 0) + 1;
    });

    const { data: analyses } = await supabase
      .from("analysis_results")
      .select("user_id");

    const analysisCount: Record<string, number> = {};
    (analyses || []).forEach(a => { analysisCount[a.user_id] = (analysisCount[a.user_id] || 0) + 1; });

    // Get subscription tier from profiles table
    const profileIds = (profiles || []).map(p => p.id);
    let tierMap: Record<string, { subscription_tier: string; max_accounts_per_platform: number }> = {};
    if (profileIds.length > 0) {
      const { data: tierData } = await supabase
        .from("profiles")
        .select("id, subscription_tier, max_accounts_per_platform")
        .in("id", profileIds);
      for (const t of (tierData || [])) {
        tierMap[t.id] = {
          subscription_tier: t.subscription_tier || "free",
          max_accounts_per_platform: t.max_accounts_per_platform || 1,
        };
      }
    }

    const users = (profiles || []).map(p => ({
      id: p.id,
      name: p.full_name || "Unknown",
      email: emailMap[p.id] || "—",
      whatsapp: p.whatsapp || "—",
      platform: p.platform || "—",
      niche: p.niche || "—",
      status: p.status || "active",
      plan: subMap[p.id]?.plan_type || "free",
      subscriptionStatus: subMap[p.id]?.status || "—",
      periodEnd: subMap[p.id]?.current_period_end || null,
      connectedAccounts: connMap[p.id] || [],
      accountsCount: connCount[p.id] || 0,
      analysesCount: analysisCount[p.id] || 0,
      apiKeysSet: p.api_keys_set || false,
      createdAt: p.created_at,
      subscriptionTier: tierMap[p.id]?.subscription_tier || "free",
      maxAccountsPerPlatform: tierMap[p.id]?.max_accounts_per_platform || 1,
    }));

    return NextResponse.json({ demo: false, users });
  } catch (e: any) {
    console.error("[/api/admin/users]", e);
    return NextResponse.json({ demo: true, users: [], error: e.message });
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = requireAdminApi(req);
  if (authErr) return authErr;

  const supabase = await getAdminSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const { userId, action, value } = await req.json();
    if (!userId || !action) return NextResponse.json({ error: "userId and action required" }, { status: 400 });

    if (action === "set_status") {
      const { error: statusErr } = await supabase
        .from("user_profiles")
        .update({ status: value, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (statusErr) throw new Error(statusErr.message);
    } else if (action === "set_plan") {
      const now = new Date().toISOString();
      const { error: planErr } = await supabase
        .from("user_subscriptions")
        .upsert(
          { user_id: userId, plan_type: value, status: "active", updated_at: now, created_at: now },
          { onConflict: "user_id" }
        );
      if (planErr) throw new Error(planErr.message);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId, action, value });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authErr = requireAdminApi(req);
  if (authErr) return authErr;

  const supabase = await getAdminSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const { email, password, fullName, whatsapp, platform, niche, plan } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // 1. Create auth user via Supabase Admin
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email (no verification needed)
      user_metadata: { full_name: fullName || "" },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Create user profile
    await supabase.from("user_profiles").upsert({
      id: userId,
      full_name: fullName || "",
      whatsapp: whatsapp || "",
      platform: platform || "",
      niche: niche || "",
      status: "active",
      api_keys_set: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    // 3. Create subscription record
    if (plan && plan !== "free") {
      await supabase.from("user_subscriptions").upsert({
        user_id: userId,
        plan_type: plan,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        name: fullName || "",
        plan: plan || "free",
      },
    });
  } catch (e: any) {
    console.error("[/api/admin/users POST]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

