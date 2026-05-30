import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publishToInstagram, publishToFacebook } from "@/lib/meta-publisher";

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
      return NextResponse.json({ error: result.error || "Publish failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, postId: result.postId });

  } catch (err: any) {
    console.error("[/api/automation/schedule/publish]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
