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
  if (errorMsg.includes("processing") || errorMsg.includes("timed out")) {
    return { message: "Video processing timed out. Try a shorter/smaller video, or try again.", retryAfterHours: 0 };
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
    let { post_id, platform, content_type, caption, media_url, carousel_urls, image_captions, account_id } = body;

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
      
      const mediaList = Array.isArray(data.media_urls) ? data.media_urls : (data.media_urls ? [data.media_urls] : []);
      media_url    = mediaList.length > 0 ? mediaList[0] : undefined;
      carousel_urls = mediaList.length > 1 ? mediaList : undefined;

      // Use account_id from DB if available (multi-account support)
      account_id   = account_id || data.account_id;

      // Mark as publishing
      await supabase.from("scheduled_posts").update({ status: "publishing" }).eq("id", post_id);
    }

    // ── Validate required fields ──────────────────────────────────
    if (!platform || !caption) {
      return NextResponse.json({ error: "Platform and caption are required" }, { status: 400 });
    }

    // ── Get connected account (multi-account aware) ──────────────
    let accountQuery = supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (account_id) {
      // Specific account requested
      accountQuery = accountQuery.eq("id", account_id);
    } else {
      // Backward compatible: first active account for platform
      accountQuery = accountQuery.eq("platform", platform);
    }

    const { data: account } = await accountQuery.limit(1).single();

    if (!account) {
      if (post_id) await supabase.from("scheduled_posts").update({ status: "failed", error_message: `${platform} not connected` }).eq("id", post_id);
      return NextResponse.json({ error: `${platform} account not connected. Go to Settings → Connected Accounts.` }, { status: 400 });
    }

    // ── Check token expiry before publishing ──────────────────────
    if (account.token_expires_at) {
      const expiresAt = new Date(account.token_expires_at).getTime();
      const now = Date.now();
      const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);

      if (expiresAt < now) {
        const errMsg = "Access token expired. Please reconnect your account from Settings → Connected Accounts.";
        if (post_id) await supabase.from("scheduled_posts").update({ status: "failed", error_message: errMsg }).eq("id", post_id);
        return NextResponse.json({ error: errMsg }, { status: 401 });
      }

      if (daysUntilExpiry < 7) {
        console.warn(`[Publish] Token for ${platform}/@${account.platform_username} expires in ${Math.floor(daysUntilExpiry)} days`);
      }
    }

    console.log(`[Publish] Publishing to ${platform}/@${account.platform_username} | Type: ${content_type} | Post ID: ${post_id || "direct"}`);

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
        imageCaptions: image_captions || undefined,
      });
    } else if (platform === "facebook") {
      // For Facebook, use page token if available (page_id stored during OAuth)
      const fbToken = account.access_token;
      const fbPageId = account.page_id || account.platform_user_id;

      result = await publishToFacebook({
        pageId:      fbPageId,
        token:       fbToken,
        contentType: content_type as any,
        caption,
        mediaUrl:    media_url || undefined,
        carouselUrls: carousel_urls || undefined,
      });
    } else {
      return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
    }

    // ── Update DB if post_id given, or Insert if Publish Now ──────
    if (post_id) {
      await supabase.from("scheduled_posts").update({
        status:        result.success ? "published" : "failed",
        published_at:  result.success ? new Date().toISOString() : null,
        error_message: result.error || null,
      }).eq("id", post_id);
    } else {
      // It's a "Publish Now", insert it to keep history
      await supabase.from("scheduled_posts").insert({
        user_id:       user.id,
        account_id:    account_id,
        platform,
        content_type,
        caption,
        media_url:     media_url || null,
        scheduled_at:  new Date().toISOString(),
        status:        result.success ? "published" : "failed",
        published_at:  result.success ? new Date().toISOString() : null,
        error_message: result.error || null,
      });
    }

    if (!result.success) {
      console.error(`[Publish] Failed: ${result.error}`);
      const parsed = parseMetaError(result.error || "Publish failed");
      const statusCode = parsed.retryAfterHours ? 429 : 500;
      return NextResponse.json(
        { error: parsed.message, retryAfterHours: parsed.retryAfterHours },
        { status: statusCode }
      );
    }

    console.log(`[Publish] ✓ Success | Platform: ${platform} | Meta Post ID: ${result.postId}`);
    return NextResponse.json({ success: true, postId: result.postId });

  } catch (err: any) {
    console.error("[/api/automation/schedule/publish]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
