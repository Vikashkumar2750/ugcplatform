import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publishToInstagram, publishToFacebook } from "@/lib/meta-publisher";

// Parse Meta API error codes into user-friendly messages
function parseMetaError(errorMsg: string): { message: string; retryAfterHours?: number } {
  if (errorMsg.includes("80002") || errorMsg.includes("too many calls")) {
    return { message: "Instagram publishing rate limit reached (25 posts/24hrs). Wait ~24 hours and try again.", retryAfterHours: 24 };
  }
  if (errorMsg.includes("32") || errorMsg.includes("Page request limit")) {
    return { message: "Facebook Page API rate limit reached. Wait 1 hour.", retryAfterHours: 1 };
  }
  if (errorMsg.includes("200") || errorMsg.includes("Permission") || errorMsg.includes("permission")) {
    return { message: "Permission denied. Reconnect your Instagram/Facebook account with publish permissions." };
  }
  if (errorMsg.includes("190") || errorMsg.includes("token") || errorMsg.includes("expired")) {
    return { message: "Access token expired. Please reconnect your account from Settings → Connected Accounts." };
  }
  if (errorMsg.includes("media_url") || errorMsg.includes("image_url") || errorMsg.includes("video_url")) {
    return { message: "Media URL is not publicly accessible. Make sure your uploaded file is public." };
  }
  return { message: errorMsg };
}

/**
 * POST /api/automation/schedule/publish
 * Body: { post_id: string }  — publish a saved scheduled post immediately
 * OR:   { platform, content_type, caption, media_url, carousel_urls? } — publish directly without saving
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    let { post_id, platform, content_type, caption, media_url, carousel_urls } = body;

    // ── If post_id given, load from DB ────────────────────────────
    let dbPost: any = null;
    if (post_id) {
      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("*")
        .eq("id", post_id)
        .eq("user_id", user.id)
        .single();
      if (error || !data) return NextResponse.json({ error: "Post not found" }, { status: 404 });
      dbPost = data;
      platform     = data.platform;
      content_type = data.content_type;
      caption      = data.caption;
      media_url    = data.media_url;

      // Mark as publishing
      await supabase.from("scheduled_posts").update({ status: "publishing" }).eq("id", post_id);
    }

    // ── Get connected account ─────────────────────────────────────
    const { data: account } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .eq("is_active", true)
      .single();

    if (!account) {
      if (post_id) await supabase.from("scheduled_posts").update({ status: "failed", error_message: `${platform} not connected` }).eq("id", post_id);
      return NextResponse.json({ error: `${platform} account not connected` }, { status: 400 });
    }

    // ── Publish ───────────────────────────────────────────────────
    let result: { success: boolean; postId?: string; error?: string };

    if (platform === "instagram") {
      result = await publishToInstagram({
        igUserId:    account.platform_user_id,
        token:       account.access_token,
        contentType: content_type as any,
        caption,
        mediaUrl:    media_url || undefined,
        carouselUrls: carousel_urls || undefined,
      });
    } else if (platform === "facebook") {
      result = await publishToFacebook({
        pageId:      account.platform_user_id,
        token:       account.access_token,
        contentType: content_type as any,
        caption,
        mediaUrl:    media_url || undefined,
      });
    } else {
      return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
    }

    // ── Update DB if post_id given ────────────────────────────────
    if (post_id) {
      await supabase.from("scheduled_posts").update({
        status:        result.success ? "published" : "failed",
        published_at:  result.success ? new Date().toISOString() : null,
        error_message: result.error || null,
      }).eq("id", post_id);
    }

    if (!result.success) {
      const parsed = parseMetaError(result.error || "Publish failed");
      const statusCode = parsed.retryAfterHours ? 429 : 500;
      return NextResponse.json(
        { error: parsed.message, retryAfterHours: parsed.retryAfterHours },
        { status: statusCode }
      );
    }

    return NextResponse.json({ success: true, postId: result.postId });

  } catch (err: any) {
    console.error("[/api/automation/schedule/publish]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
