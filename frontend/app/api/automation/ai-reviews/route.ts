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

// GET /api/automation/ai-reviews
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";

  let reviews: any[] = [];

  if (status === "resolved") {
    // Get all non-pending (approved, edited, discarded)
    const { data } = await supabase
      .from("human_review_queue")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(50);
    reviews = data || [];
  } else {
    // Get by exact status (default: pending)
    const { data } = await supabase
      .from("human_review_queue")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(50);
    reviews = data || [];
  }

  return NextResponse.json({ reviews });
}

// POST /api/automation/ai-reviews
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  const { reviewId, action, editedText } = await request.json();

  if (!reviewId || !action) {
    return NextResponse.json({ error: "reviewId and action required" }, { status: 400 });
  }

  if (action === "approve") {
    const newStatus = editedText ? "edited" : "approved";
    await supabase.from("human_review_queue").update({
      status: newStatus,
      agent_id: user.id,
      agent_edit: editedText || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", reviewId).eq("user_id", user.id);

    // Enqueue the message
    const { data: review } = await supabase
      .from("human_review_queue")
      .select("*")
      .eq("id", reviewId)
      .single();

    if (review) {
      const BACKEND_URL = process.env.RENDER_WORKER_URL || "http://localhost:3001";
      const WORKER_SECRET = process.env.RENDER_WORKER_SECRET || process.env.WORKER_SECRET || "";

      await fetch(`${BACKEND_URL}/api/messaging/enqueue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-worker-secret": WORKER_SECRET,
        },
        body: JSON.stringify({
          accountId: review.account_id,
          userId: review.user_id,
          recipientId: review.recipient_id,
          messagePayload: { text: editedText || review.ai_draft_text },
          messageType: "dm",
        }),
      });
    }

    return NextResponse.json({ success: true, status: newStatus });
  }

  if (action === "discard") {
    await supabase.from("human_review_queue").update({
      status: "discarded",
      agent_id: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", reviewId).eq("user_id", user.id);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
