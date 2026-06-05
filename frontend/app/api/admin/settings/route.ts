import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, getAdminSupabase } from "@/lib/admin-auth";

// GET — fetch all platform settings + promo codes
export async function GET(req: NextRequest) {
  const authErr = requireAdminApi(req);
  if (authErr) return authErr;

  const supabase = await getAdminSupabase();
  if (!supabase) return NextResponse.json({ demo: true, settings: {}, promos: [] });

  try {
    const { data: rows } = await supabase.from("platform_settings").select("key, value");
    const { data: promos } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });

    const settings = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
    return NextResponse.json({ demo: false, settings, promos: promos || [] });
  } catch (e: any) {
    console.error("[/api/admin/settings GET]", e);
    return NextResponse.json({ demo: true, settings: {}, promos: [], error: e.message });
  }
}

// POST — save platform settings
export async function POST(req: NextRequest) {
  const authErr = requireAdminApi(req);
  if (authErr) return authErr;

  const supabase = await getAdminSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const body = await req.json();
    const { settings, promoAction, promo } = body;

    // Save settings as key-value pairs
    if (settings && typeof settings === "object") {
      const upserts = Object.entries(settings).map(([key, value]) => ({
        key,
        value: String(value),
        updated_at: new Date().toISOString(),
      }));
      if (upserts.length > 0) {
        const { error } = await supabase
          .from("platform_settings")
          .upsert(upserts, { onConflict: "key" });
        if (error) throw error;
      }
    }

    // Handle promo code actions
    if (promoAction === "add" && promo) {
      await supabase.from("promo_codes").insert({
        code: promo.code.toUpperCase(),
        discount_percent: promo.discount,
        max_uses: promo.maxUses || 100,
        expiry_date: promo.expiry || null,
        is_active: true,
      });
    } else if (promoAction === "toggle" && promo?.id) {
      await supabase
        .from("promo_codes")
        .update({ is_active: !promo.is_active })
        .eq("id", promo.id);
    } else if (promoAction === "delete" && promo?.id) {
      await supabase.from("promo_codes").delete().eq("id", promo.id);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[/api/admin/settings POST]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
