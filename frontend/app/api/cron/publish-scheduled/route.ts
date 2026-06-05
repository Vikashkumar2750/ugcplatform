import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publishToInstagram, publishToFacebook } from "@/lib/meta-publisher";

/**
 * GET /api/cron/publish-scheduled
 * Called by Vercel cron every 5 minutes.
 * Finds all posts with scheduled_at <= now and status = 'scheduled', publishes them.
 */
export async function GET(request: NextRequest) {
  // Security: verify it's a Vercel cron call
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Use service role to query all users' posts
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all posts due for publishing
    const now = new Date().toISOString();
    const { data: duePosts, error } = await supabase
      .from("scheduled_posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", now)
      .limit(20);

    if (error) throw error;
    if (!duePosts || duePosts.length === 0) {
      return NextResponse.json({ processed: 0, message: "No posts due" });
    }

    console.log(`[Cron] Publishing ${duePosts.length} scheduled posts`);
    const results: { id: string; status: string; error?: string }[] = [];

    for (const post of duePosts) {
      // Mark as publishing
      await supabase.from("scheduled_posts")
        .update({ status: "publishing" })
        .eq("id", post.id);

      // Get connected account for this user
      const { data: account } = await supabase
        .from("connected_accounts")
        .select("*")
        .eq("user_id", post.user_id)
        .eq("platform", post.platform)
        .eq("is_active", true)
        .single();

      if (!account) {
        await supabase.from("scheduled_posts").update({
          status: "failed",
          error_message: `${post.platform} account not connected`,
        }).eq("id", post.id);
        results.push({ id: post.id, status: "failed", error: "Account not connected" });
        continue;
      }

      let result: { success: boolean; postId?: string; error?: string };

      try {
        if (post.platform === "instagram") {
          result = await publishToInstagram({
            igUserId:    account.platform_user_id,
            token:       account.access_token,
            contentType: post.content_type,
            caption:     post.caption,
            mediaUrl:    post.media_url || undefined,
          });
        } else {
          result = await publishToFacebook({
            pageId:      account.platform_user_id,
            token:       account.access_token,
            contentType: post.content_type,
            caption:     post.caption,
            mediaUrl:    post.media_url || undefined,
          });
        }
      } catch (err: any) {
        result = { success: false, error: err.message };
      }

      await supabase.from("scheduled_posts").update({
        status:        result.success ? "published" : "failed",
        published_at:  result.success ? new Date().toISOString() : null,
        error_message: result.error || null,
      }).eq("id", post.id);

      results.push({ id: post.id, status: result.success ? "published" : "failed", error: result.error });
    }

    return NextResponse.json({ processed: duePosts.length, results });

  } catch (err: any) {
    console.error("[Cron Publish]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
