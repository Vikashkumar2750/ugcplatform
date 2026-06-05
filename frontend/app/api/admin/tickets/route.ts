import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, getAdminSupabase } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authErr = requireAdminApi(req);
  if (authErr) return authErr;

  const supabase = await getAdminSupabase();
  if (!supabase) return NextResponse.json({ demo: true, tickets: [] });

  try {
    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("*, support_messages(*)")
      .order("created_at", { ascending: false });

    return NextResponse.json({ demo: false, tickets: tickets || [] });
  } catch (e: any) {
    return NextResponse.json({ demo: true, tickets: [], error: e.message });
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = requireAdminApi(req);
  if (authErr) return authErr;

  const supabase = await getAdminSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const { ticketId, action, value, message } = await req.json();

    if (action === "set_status") {
      await supabase.from("support_tickets").update({
        status: value,
        updated_at: new Date().toISOString(),
        ...(value === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
      }).eq("id", ticketId);
    } else if (action === "reply") {
      await supabase.from("support_messages").insert({
        ticket_id: ticketId,
        sender_role: "admin",
        sender_name: "Content Engineer Support",
        content: message,
      });
      await supabase.from("support_tickets").update({
        status: "in_progress",
        updated_at: new Date().toISOString(),
      }).eq("id", ticketId);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
