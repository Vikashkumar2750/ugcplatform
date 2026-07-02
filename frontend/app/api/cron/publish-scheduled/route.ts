import { NextRequest, NextResponse } from "next/server";
import { publishToInstagram, publishToFacebook } from "@/lib/meta-publisher";

/**
 * GET /api/cron/publish-scheduled
 * Called by Vercel cron every 5 minutes.
 * Finds all posts with scheduled_at <= now and status = 'scheduled', publishes them.
 * 
 * Improvements:
 * - Retry failed posts (up to 3 attempts via retry_count column)
 * - Better error categorization (retryable vs permanent)
 * - Token validity check before publish
 */
export async function GET(request: NextRequest) {
  // Security: verify it's a Vercel cron call
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date().toISOString();

    // Fetch posts due for publishing (scheduled) + failed posts eligible for retry
    const { data: duePosts, error } = await supabase
      .from("scheduled_posts")
      .select("*")
      .or(`and(status.eq.scheduled,scheduled_at.lte.${now}),and(status.eq.failed,retry_count.lt.3,scheduled_at.lte.${now})`)
      .limit(20);

    if (error) throw error;
    if (!duePosts || duePosts.length === 0) {
      return NextResponse.json({ processed: 0, message: "No posts due" });
    }

    console.log(`[Cron] Publishing ${duePosts.length} posts (scheduled + retries)`);
    const results: { id: string; status: string; error?: string; attempt?: number }[] = [];

    for (const post of duePosts) {
      const attempt = (post.retry_count || 0) + 1;

      // Mark as publishing
      await supabase.from("scheduled_posts")
        .update({ status: "publishing" })
        .eq("id", post.id);

      // Get connected account (multi-account aware)
      let accountQuery = supabase
        .from("connected_accounts")
        .select("*")
        .eq("user_id", post.user_id)
        .eq("is_active", true);

      if (post.account_id) {
        // Use specific account from the scheduled post
        accountQuery = accountQuery.eq("id", post.account_id);
      } else {
        // Backward compatible: first active account for platform
        accountQuery = accountQuery.eq("platform", post.platform);
      }

      const { data: account } = await accountQuery.limit(1).single();

      if (!account) {
        await supabase.from("scheduled_posts").update({
          status: "failed",
          error_message: `${post.platform} account not connected`,
          retry_count: attempt,
        }).eq("id", post.id);
        results.push({ id: post.id, status: "failed", error: "Account not connected", attempt });
        continue;
      }

      // Check token validity (basic check — expiry date)
      if (account.token_expires_at) {
        const expiresAt = new Date(account.token_expires_at).getTime();
        if (expiresAt < Date.now()) {
          await supabase.from("scheduled_posts").update({
            status: "failed",
            error_message: "Access token expired — reconnect your account",
            retry_count: 3, // Don't retry expired tokens
          }).eq("id", post.id);
          results.push({ id: post.id, status: "failed", error: "Token expired", attempt });
          continue;
        }
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

      // Determine if error is retryable
      const isPermissionError = result.error?.includes("Permission") || result.error?.includes("190") || result.error?.includes("token");
      const maxRetryCount = isPermissionError ? 3 : 3; // Don't retry permission errors

      await supabase.from("scheduled_posts").update({
        status:        result.success ? "published" : "failed",
        published_at:  result.success ? new Date().toISOString() : null,
        error_message: result.error || null,
        retry_count:   result.success ? 0 : (isPermissionError ? 3 : attempt),
      }).eq("id", post.id);

      results.push({
        id: post.id,
        status: result.success ? "published" : "failed",
        error: result.error,
        attempt,
      });
    }

    return NextResponse.json({ processed: duePosts.length, results });

  } catch (err: any) {
    console.error("[Cron Publish]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
