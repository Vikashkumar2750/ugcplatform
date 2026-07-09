import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const userId = session?.user?.id;
    
    if (!token || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const BACKEND_URL = process.env.RENDER_WORKER_URL || "http://localhost:3001";
    
    const aiRes = await fetch(`${BACKEND_URL}/api/insights/generate-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      return NextResponse.json({ error: "AI Generation failed", details: errorText }, { status: aiRes.status });
    }

    const aiJson = await aiRes.json();

    if (body.platform && body.statsData && body.statsData.accountId) {
      try {
        const { setDailyCache } = await import("@/lib/insights-cache");
        await setDailyCache(supabase, userId, `${body.platform}_${body.statsData.accountId}`, { 
          ...body.statsData, 
          aiData: aiJson.aiData 
        });
      } catch (cacheErr) {
        console.error("Failed to update daily cache with AI data:", cacheErr);
      }
    }

    return NextResponse.json(aiJson);
  } catch (err: any) {
    console.error("[/api/insights/generate-ai proxy]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
