/**
 * meta-publisher.ts
 * Publishes content to Instagram and Facebook via Meta Graph API.
 * 
 * Fixes applied:
 * - Carousel children sent as proper array (not comma-separated string)
 * - Exponential backoff for video processing status checks
 * - Story support for both photo and video
 * - Retry logic for transient failures
 * - Proper Facebook Page token usage
 */

const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

type ContentType = "photo" | "video" | "reel" | "carousel" | "story" | "post";

interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
  errorCode?: number;
}

// ── Helpers ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** Wait for a media container to finish processing with exponential backoff */
async function waitForProcessing(
  containerId: string,
  token: string,
  maxAttempts: number = 15,
  initialDelayMs: number = 3000
): Promise<{ ready: boolean; error?: string }> {
  let delay = initialDelayMs;
  
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(delay);
    
    try {
      const statusRes = await fetch(
        `${BASE_URL}/${containerId}?fields=status_code,status&access_token=${token}`
      );
      const status = await statusRes.json();
      
      if (status.status_code === "FINISHED") return { ready: true };
      if (status.status_code === "ERROR") {
        return { ready: false, error: `Media processing failed: ${status.status || "Unknown error"}` };
      }
      if (status.status_code === "EXPIRED") {
        return { ready: false, error: "Media container expired before publishing" };
      }
      
      console.log(`[Publisher] Processing attempt ${i + 1}/${maxAttempts}: status=${status.status_code}`);
    } catch (err: any) {
      console.warn(`[Publisher] Status check attempt ${i + 1} failed: ${err.message}`);
    }
    
    // Exponential backoff: 3s, 4.5s, 6.75s, 10s, 15s... (capped at 15s)
    delay = Math.min(delay * 1.5, 15000);
  }
  
  return { ready: false, error: "Media processing timed out after max attempts" };
}

/** Parse Meta API error response */
function parseMetaApiError(data: any): { message: string; code?: number } {
  if (data?.error) {
    return {
      message: data.error.message || data.error.error_user_msg || "Unknown Meta API error",
      code: data.error.code,
    };
  }
  return { message: "Unknown error" };
}

// ── Instagram ──────────────────────────────────────────────────────

interface InstagramPublishOptions {
  igUserId: string;
  token: string;
  contentType: ContentType;
  caption: string;
  mediaUrl?: string;
  carouselUrls?: string[];
}

export async function publishToInstagram(opts: InstagramPublishOptions): Promise<PublishResult> {
  const { igUserId, token, contentType, caption, mediaUrl, carouselUrls } = opts;

  try {
    // ── Carousel ──
    if (contentType === "carousel" && carouselUrls?.length) {
      console.log(`[Publisher] Creating carousel with ${carouselUrls.length} items`);
      
      // Step 1: Create individual carousel items
      const itemIds: string[] = [];
      for (const url of carouselUrls) {
        const isVideo = /\.(mp4|mov|avi|webm)$/i.test(url);
        const body: Record<string, any> = {
          is_carousel_item: true,
          access_token: token,
        };
        
        if (isVideo) {
          body.media_type = "VIDEO";
          body.video_url = url;
        } else {
          body.image_url = url;
        }

        const r = await fetch(`${BASE_URL}/${igUserId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await r.json();
        if (d.error) throw new Error(parseMetaApiError(d).message);
        itemIds.push(d.id);
        
        // Wait for video items to process
        if (isVideo) {
          const { ready, error } = await waitForProcessing(d.id, token, 12);
          if (!ready) throw new Error(error || "Carousel video processing failed");
        }
      }

      // Step 2: Create carousel container — children as proper array
      const containerRes = await fetch(`${BASE_URL}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: itemIds,  // Array, NOT comma-separated string
          caption,
          access_token: token,
        }),
      });
      const container = await containerRes.json();
      if (container.error) throw new Error(parseMetaApiError(container).message);

      // Step 3: Publish
      const publishRes = await fetch(`${BASE_URL}/${igUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: container.id, access_token: token }),
      });
      const pub = await publishRes.json();
      if (pub.error) throw new Error(parseMetaApiError(pub).message);
      return { success: true, postId: pub.id };
    }

    // ── Reel / Video ──
    if (contentType === "reel" || contentType === "video") {
      if (!mediaUrl) {
        return { success: false, error: "Video URL is required for Reels. Upload a video first." };
      }

      console.log(`[Publisher] Creating Reel container`);
      const containerRes = await fetch(`${BASE_URL}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "REELS",
          video_url: mediaUrl,
          caption,
          access_token: token,
        }),
      });
      const container = await containerRes.json();
      if (container.error) throw new Error(parseMetaApiError(container).message);

      // Wait for video processing with exponential backoff
      const { ready, error } = await waitForProcessing(container.id, token, 15, 5000);
      if (!ready) throw new Error(error || "Video processing timed out");

      const publishRes = await fetch(`${BASE_URL}/${igUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: container.id, access_token: token }),
      });
      const pub = await publishRes.json();
      if (pub.error) throw new Error(parseMetaApiError(pub).message);
      return { success: true, postId: pub.id };
    }

    // ── Story (Photo or Video) ──
    if (contentType === "story") {
      if (!mediaUrl) {
        return { success: false, error: "Media URL is required for Stories" };
      }

      const isVideo = /\.(mp4|mov|avi|webm)$/i.test(mediaUrl);
      const containerBody: Record<string, any> = {
        media_type: "STORIES",
        access_token: token,
      };

      if (isVideo) {
        containerBody.video_url = mediaUrl;
      } else {
        containerBody.image_url = mediaUrl;
      }

      console.log(`[Publisher] Creating Story container (${isVideo ? "video" : "photo"})`);
      const containerRes = await fetch(`${BASE_URL}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerBody),
      });
      const container = await containerRes.json();
      if (container.error) throw new Error(parseMetaApiError(container).message);

      // Wait for video stories
      if (isVideo) {
        const { ready, error } = await waitForProcessing(container.id, token, 12);
        if (!ready) throw new Error(error || "Story video processing failed");
      } else {
        // Photo stories need a brief wait too
        await sleep(2000);
      }

      const publishRes = await fetch(`${BASE_URL}/${igUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: container.id, access_token: token }),
      });
      const pub = await publishRes.json();
      if (pub.error) throw new Error(parseMetaApiError(pub).message);
      return { success: true, postId: pub.id };
    }

    // ── Photo / Post ──
    if (!mediaUrl) {
      return { success: false, error: "Image URL is required for photo posts. Upload an image first." };
    }

    console.log(`[Publisher] Creating photo container`);
    const containerRes = await fetch(`${BASE_URL}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: mediaUrl,
        caption,
        access_token: token,
      }),
    });
    const container = await containerRes.json();
    if (container.error) throw new Error(parseMetaApiError(container).message);

    // Brief wait for photo processing
    await sleep(2000);

    const publishRes = await fetch(`${BASE_URL}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    });
    const pub = await publishRes.json();
    if (pub.error) throw new Error(parseMetaApiError(pub).message);
    return { success: true, postId: pub.id };

  } catch (err: any) {
    console.error("[Publisher] Instagram publish failed:", err.message);
    return { success: false, error: err.message };
  }
}

// ── Facebook ───────────────────────────────────────────────────────

interface FacebookPublishOptions {
  pageId: string;
  token: string;
  contentType: ContentType;
  caption: string;
  mediaUrl?: string;
}

export async function publishToFacebook(opts: FacebookPublishOptions): Promise<PublishResult> {
  const { pageId, token, contentType, caption, mediaUrl } = opts;

  try {
    // ── Video / Reel ──
    if (contentType === "video" || contentType === "reel") {
      if (!mediaUrl) {
        return { success: false, error: "Video URL is required" };
      }

      console.log(`[Publisher] Publishing Facebook video/reel`);
      const r = await fetch(`${BASE_URL}/${pageId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_url: mediaUrl,
          description: caption,
          access_token: token,
        }),
      });
      const d = await r.json();
      if (d.error) throw new Error(parseMetaApiError(d).message);
      return { success: true, postId: d.id };
    }

    // ── Photo ──
    if (mediaUrl) {
      console.log(`[Publisher] Publishing Facebook photo`);
      const r = await fetch(`${BASE_URL}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: mediaUrl,
          caption,
          access_token: token,
        }),
      });
      const d = await r.json();
      if (d.error) throw new Error(parseMetaApiError(d).message);
      return { success: true, postId: d.post_id || d.id };
    }

    // ── Text post ──
    console.log(`[Publisher] Publishing Facebook text post`);
    const r = await fetch(`${BASE_URL}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: caption,
        access_token: token,
      }),
    });
    const d = await r.json();
    if (d.error) throw new Error(parseMetaApiError(d).message);
    return { success: true, postId: d.id };

  } catch (err: any) {
    console.error("[Publisher] Facebook publish failed:", err.message);
    return { success: false, error: err.message };
  }
}
