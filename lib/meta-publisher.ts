/**
 * lib/meta-publisher.ts
 * Handles actual publishing to Instagram and Facebook via Meta Graph API.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

// ── Instagram ─────────────────────────────────────────────────────

export interface IGPublishParams {
  igUserId: string;
  token: string;
  contentType: "reel" | "post" | "story" | "carousel";
  caption: string;
  mediaUrl?: string;         // public URL (image or video)
  carouselUrls?: string[];   // for carousel only
}

async function pollIGStatus(containerId: string, token: string, maxWaitMs = 60000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise<void>(resolve => setTimeout(resolve, 5000));
    const res = await fetch(`${GRAPH}/${containerId}?fields=status_code,status&access_token=${token}`);
    const data = await res.json();
    if (data.status_code === "FINISHED" || data.status === "FINISHED") return true;
    if (data.status_code === "ERROR" || data.status === "ERROR") return false;
  }
  return false;
}

export async function publishToInstagram(params: IGPublishParams): Promise<{ success: boolean; postId?: string; error?: string }> {
  const { igUserId, token, contentType, caption, mediaUrl, carouselUrls } = params;

  try {
    // ── Carousel ────────────────────────────────────────────────
    if (contentType === "carousel" && carouselUrls && carouselUrls.length > 1) {
      const itemIds: string[] = [];
      for (const url of carouselUrls) {
        const isVideo = /\.(mp4|mov)$/i.test(url);
        const body: Record<string, string> = {
          is_carousel_item: "true",
          access_token: token,
        };
        if (isVideo) { body.video_url = url; body.media_type = "VIDEO"; }
        else { body.image_url = url; }

        const res = await fetch(`${GRAPH}/${igUserId}/media`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        if (isVideo) await pollIGStatus(data.id, token, 90000);
        itemIds.push(data.id);
      }

      const carouselRes = await fetch(`${GRAPH}/${igUserId}/media`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_type: "CAROUSEL", caption, children: itemIds.join(","), access_token: token }),
      });
      const carousel = await carouselRes.json();
      if (carousel.error) throw new Error(carousel.error.message);

      const pubRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: carousel.id, access_token: token }),
      });
      const pub = await pubRes.json();
      if (pub.error) throw new Error(pub.error.message);
      return { success: true, postId: pub.id };
    }

    // ── Single media (Reel, Post, Story) ────────────────────────
    const isVideo = mediaUrl ? /\.(mp4|mov)$/i.test(mediaUrl) : contentType === "reel";
    const body: Record<string, string> = { caption, access_token: token };

    if (contentType === "reel") {
      body.media_type = "REELS";
      if (mediaUrl) body.video_url = mediaUrl;
    } else if (contentType === "story") {
      body.media_type = "STORIES";
      if (mediaUrl) {
        if (isVideo) body.video_url = mediaUrl;
        else body.image_url = mediaUrl;
      }
    } else {
      // post (single image)
      if (mediaUrl) body.image_url = mediaUrl;
    }

    const containerRes = await fetch(`${GRAPH}/${igUserId}/media`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const container = await containerRes.json();
    if (container.error) throw new Error(container.error.message);

    // Poll for video processing
    if (isVideo || contentType === "reel") {
      const done = await pollIGStatus(container.id, token, 120000);
      if (!done) throw new Error("Video processing timed out. Try again.");
    }

    const pubRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    });
    const pub = await pubRes.json();
    if (pub.error) throw new Error(pub.error.message);
    return { success: true, postId: pub.id };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Facebook ──────────────────────────────────────────────────────

export interface FBPublishParams {
  pageId: string;
  token: string;
  contentType: "post" | "reel" | "story";
  caption: string;
  mediaUrl?: string;
}

export async function publishToFacebook(params: FBPublishParams): Promise<{ success: boolean; postId?: string; error?: string }> {
  const { pageId, token, contentType, caption, mediaUrl } = params;

  try {
    const isVideo = mediaUrl ? /\.(mp4|mov)$/i.test(mediaUrl) : false;
    let endpoint = `${GRAPH}/${pageId}/feed`;
    const body: Record<string, string> = { message: caption, access_token: token };

    if (mediaUrl && isVideo) {
      endpoint = `${GRAPH}/${pageId}/videos`;
      body.file_url = mediaUrl;
      body.description = caption;
      delete body.message;
    } else if (mediaUrl && !isVideo) {
      endpoint = `${GRAPH}/${pageId}/photos`;
      body.url = mediaUrl;
      body.caption = caption;
      delete body.message;
    }

    const res = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { success: true, postId: data.id || data.post_id };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
