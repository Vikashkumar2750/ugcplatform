import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const BACKEND_URL = process.env.RENDER_WORKER_URL || "http://localhost:3001";
    const searchParams = request.nextUrl.search;
    const params = await context.params;
    
    // Ensure params.path exists
    if (!params || !params.path || params.path.length === 0) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const pathString = params.path.join("/");

    const res = await fetch(`${BACKEND_URL}/api/insights/${pathString}${searchParams}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("[/api/insights/proxy]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
