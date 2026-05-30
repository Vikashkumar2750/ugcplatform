import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── Period helpers ────────────────────────────────────────────────
function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ── Task generators from insights data ──────────────────────────
function generateWeeklyTasks(platform: string, insights: any): { title: string; description: string }[] {
  const tasks: { title: string; description: string }[] = [];

  if (platform === "instagram") {
    const er = insights?.engagementRate || 0;
    const posts7d = insights?.posts7dCount || 0;
    const avgSaves = insights?.avgSaves || 0;

    if (posts7d < 3) tasks.push({
      title: "Post at least 3 times this week",
      description: "Is hafte 3+ posts karo (Reels priority mein). Algorithm consistency prefer karta hai.",
    });
    if (er < 3) tasks.push({
      title: "Add CTA to every caption",
      description: "Caption ke end mein question ya action add karo: 'Comment karo 👇' or 'Save for later 🔖'",
    });
    tasks.push({
      title: "Reply to all comments within 24h",
      description: "Har comment ka reply do — algorithm engagement window mein count karta hai.",
    });
    if (avgSaves < 5) tasks.push({
      title: "Add 'Save this!' CTA in 2 posts",
      description: "Saves algorithm ranking mein like/comments se zyada important hain.",
    });
    tasks.push({
      title: "Post at peak time (7–9 PM IST)",
      description: "Indian audience ke liye evening peak hai. Mon, Wed, Fri ko post karo.",
    });
    tasks.push({
      title: "Use 5–10 targeted hashtags",
      description: "Niche-specific hashtags use karo. Broad hashtags (50M+) avoid karo.",
    });
  }

  if (platform === "facebook") {
    const posts = insights?.postsCount || 0;
    tasks.push({
      title: "Post 2-3 times this week",
      description: "Facebook pages ko consistent posting chahiye — 2-3 per week ideal hai.",
    });
    tasks.push({
      title: "Boost best post with ₹100",
      description: "Iss hafte ka top-performing post boost karo for more reach.",
    });
    tasks.push({
      title: "Reply to all page comments",
      description: "Page engagement badhane ke liye sabhi comments ka jawab do.",
    });
  }

  return tasks.slice(0, 5);
}

function generateMonthlyTasks(platform: string, insights: any): { title: string; description: string }[] {
  const tasks: { title: string; description: string }[] = [];

  if (platform === "instagram") {
    const followers = insights?.followers || 0;
    const er = insights?.engagementRate || 0;
    const mediaCount = insights?.mediaCount || 0;
    const avgSaves = insights?.avgSaves || 0;

    // Dynamic follower target (+5-10%)
    const followerTarget = Math.max(100, Math.round(followers * 0.08));
    tasks.push({
      title: `${followerTarget} new followers this month`,
      description: `Current: ${followers.toLocaleString()}. Target: ${(followers + followerTarget).toLocaleString()}. Reels + collab karo.`,
    });

    // ER improvement
    const erTarget = Math.min(10, parseFloat((er + 0.5).toFixed(1)));
    tasks.push({
      title: `Improve ER to ${erTarget}%`,
      description: `Current ER: ${er}%. Better captions + timing se improve hoga.`,
    });

    // Posting frequency
    tasks.push({
      title: "Post at least 12 times this month",
      description: "3 posts/week = 12/month. Reels > Carousels > Static posts priority mein.",
    });

    // Saves goal
    const savesTarget = Math.max(10, avgSaves * 3);
    tasks.push({
      title: `Get ${savesTarget}+ saves on at least 2 posts`,
      description: "Saves = content quality signal. Educational, 'how-to', and list posts best perform.",
    });

    tasks.push({
      title: "Collaborate with 1 creator this month",
      description: "Collab posts dono accounts ke followers ko dikhte hain — organic reach boost.",
    });
  }

  if (platform === "facebook") {
    const fans = insights?.fans || 0;
    const fanTarget = Math.max(50, Math.round(fans * 0.05));
    tasks.push({
      title: `Gain ${fanTarget} new page followers`,
      description: `Current: ${fans.toLocaleString()}. Invite existing contacts + boost best post.`,
    });
    tasks.push({
      title: "Post 10+ times this month",
      description: "Facebook algorithm ko consistency chahiye. Mix of videos, images, and text.",
    });
    tasks.push({
      title: "Run 1 engagement campaign",
      description: "Simple question post ya poll run karo — page engagement metrics boost hogi.",
    });
  }

  return tasks.slice(0, 5);
}

// ── GET — fetch/generate tasks for current period ─────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const platform = request.nextUrl.searchParams.get("platform") || "instagram";
    const monthKey = getMonthKey();
    const weekKey = getWeekKey();

    // ── Check existing tasks for current periods ──────────────────
    const { data: existingTasks } = await supabase
      .from("insight_tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .in("period_key", [monthKey, weekKey])
      .order("created_at", { ascending: true });

    const monthTasks = (existingTasks || []).filter(t => t.period_key === monthKey);
    const weekTasks  = (existingTasks || []).filter(t => t.period_key === weekKey);

    // ── Archive previous period tasks if new month ────────────────
    const { data: oldTasks } = await supabase
      .from("insight_tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .not("period_key", "in", `(${monthKey},${weekKey})`);

    if (oldTasks && oldTasks.length > 0) {
      // Group by period_key and archive
      const byPeriod: Record<string, any[]> = {};
      for (const t of oldTasks) {
        byPeriod[t.period_key] = byPeriod[t.period_key] || [];
        byPeriod[t.period_key].push(t);
      }
      for (const [pKey, tasks] of Object.entries(byPeriod)) {
        await supabase.from("insight_task_history").upsert({
          user_id: user.id,
          platform,
          period_key: pKey,
          tasks_total: tasks.length,
          tasks_done: tasks.filter(t => t.status === "done").length,
          tasks_skipped: tasks.filter(t => t.status === "skipped").length,
        }, { onConflict: "user_id,platform,period_key" });
      }
      // Delete old period tasks
      await supabase
        .from("insight_tasks")
        .delete()
        .eq("user_id", user.id)
        .eq("platform", platform)
        .not("period_key", "in", `(${monthKey},${weekKey})`);

      // Keep only last 3 months history
      const { data: allHistory } = await supabase
        .from("insight_task_history")
        .select("id, period_key")
        .eq("user_id", user.id)
        .eq("platform", platform)
        .order("period_key", { ascending: false });

      if (allHistory && allHistory.length > 3) {
        const toDelete = allHistory.slice(3).map(h => h.id);
        await supabase.from("insight_task_history").delete().in("id", toDelete);
      }
    }

    // ── Auto-generate if no tasks for current period ──────────────
    let needsInsights = monthTasks.length === 0 || weekTasks.length === 0;
    let insights: any = null;

    if (needsInsights) {
      // Fetch current insights snapshot to generate context-aware tasks
      try {
        const insRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/insights/${platform}`, {
          headers: { cookie: request.headers.get("cookie") || "" },
        });
        if (insRes.ok) insights = await insRes.json();
      } catch {}
    }

    // Auto-generate monthly tasks
    if (monthTasks.length === 0) {
      const generated = generateMonthlyTasks(platform, insights);
      const toInsert = generated.map(t => ({
        user_id: user.id,
        platform,
        title: t.title,
        description: t.description,
        type: "monthly",
        period_key: monthKey,
        status: "pending",
        auto_generated: true,
      }));
      if (toInsert.length > 0) {
        await supabase.from("insight_tasks").insert(toInsert);
      }
    }

    // Auto-generate weekly tasks
    if (weekTasks.length === 0) {
      const generated = generateWeeklyTasks(platform, insights);
      const toInsert = generated.map(t => ({
        user_id: user.id,
        platform,
        title: t.title,
        description: t.description,
        type: "weekly",
        period_key: weekKey,
        status: "pending",
        auto_generated: true,
      }));
      if (toInsert.length > 0) {
        await supabase.from("insight_tasks").insert(toInsert);
      }
    }

    // ── Fetch final tasks ─────────────────────────────────────────
    const { data: finalTasks } = await supabase
      .from("insight_tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .in("period_key", [monthKey, weekKey])
      .order("created_at", { ascending: true });

    return NextResponse.json({
      monthKey,
      weekKey,
      monthly: (finalTasks || []).filter(t => t.period_key === monthKey),
      weekly:  (finalTasks || []).filter(t => t.period_key === weekKey),
    });

  } catch (err: any) {
    console.error("[/api/insights/tasks GET]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST — mark task done/skipped OR add custom task ─────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    // Update existing task status
    if (body.id && body.status) {
      const { error } = await supabase
        .from("insight_tasks")
        .update({
          status: body.status,
          completed_at: body.status === "done" ? new Date().toISOString() : null,
        })
        .eq("id", body.id)
        .eq("user_id", user.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Add custom task
    if (body.title && body.platform && body.type) {
      const monthKey = getMonthKey();
      const weekKey = getWeekKey();
      const { data, error } = await supabase
        .from("insight_tasks")
        .insert({
          user_id: user.id,
          platform: body.platform,
          title: body.title,
          description: body.description || null,
          type: body.type,
          period_key: body.type === "monthly" ? monthKey : weekKey,
          status: "pending",
          auto_generated: false,
        })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, task: data });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  } catch (err: any) {
    console.error("[/api/insights/tasks POST]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
