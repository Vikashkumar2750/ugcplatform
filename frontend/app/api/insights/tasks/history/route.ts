import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const platform = request.nextUrl.searchParams.get("platform") || "instagram";

    const { data: history, error } = await supabase
      .from("insight_task_history")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .order("period_key", { ascending: false })
      .limit(3);

    if (error) throw error;

    return NextResponse.json({ history: history || [] });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
