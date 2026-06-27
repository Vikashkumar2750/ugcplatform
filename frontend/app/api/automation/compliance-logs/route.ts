import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || request.cookies.get("sb-access-token")?.value;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  if (authHeader) {
    const token = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : authHeader;
    const { data } = await supabase.auth.getUser(token);
    return data.user;
  }
  return null;
}

// GET /api/automation/compliance-logs
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "100");
  const decision = searchParams.get("decision");

  let query = supabase
    .from("compliance_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (decision) {
    query = query.eq("decision", decision);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ logs: [], error: error.message });
  }

  return NextResponse.json({ logs: data || [] });
}
