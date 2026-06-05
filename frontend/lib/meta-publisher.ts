/**
 * meta-publisher.ts
 * Publishes content to Instagram and Facebook via Meta Graph API.
 */

type ContentType = "photo" | "video" | "reel" | "carousel" | "story";

interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
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
  const base = `https://graph.facebook.com/v21.0`;

  try {
    // Carousel
    if (contentType === "carousel" && carouselUrls?.length) {
      const itemIds: string[] = [];
      for (const url of carouselUrls) {
        const r = await fetch(`${base}/${igUserId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: token }),
        });
        const d = await r.json();
        if (d.error) throw new Error(d.error.message);
        itemIds.push(d.id);
      }
      const containerRes = await fetch(`${base}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_type: "CAROUSEL", children: itemIds.join(","), caption, access_token: token }),
      });
      const container = await containerRes.json();
      if (container.error) throw new Error(container.error.message);

      const publishRes = await fetch(`${base}/${igUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: container.id, access_token: token }),
      });
      const pub = await publishRes.json();
      if (pub.error) throw new Error(pub.error.message);
      return { success: true, postId: pub.id };
    }

    // Reel / Video
    if (contentType === "reel" || contentType === "video") {
      const containerRes = await fetch(`${base}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_type: "REELS", video_url: mediaUrl, caption, access_token: token }),
      });
      const container = await containerRes.json();
      if (container.error) throw new Error(container.error.message);

      // Wait for processing
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetch(`${base}/${container.id}?fields=status_code&access_token=${token}`);
        const status = await statusRes.json();
        if (status.status_code === "FINISHED") break;
        if (status.status_code === "ERROR") throw new Error("Video processing failed");
      }

      const publishRes = await fetch(`${base}/${igUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: container.id, access_token: token }),
      });
      const pub = await publishRes.json();
      if (pub.error) throw new Error(pub.error.message);
      return { success: true, postId: pub.id };
    }

    // Photo / Story
    const containerRes = await fetch(`${base}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: mediaUrl,
        caption,
        media_type: contentType === "story" ? "STORIES" : undefined,
        access_token: token,
      }),
    });
    const container = await containerRes.json();
    if (container.error) throw new Error(container.error.message);

    const publishRes = await fetch(`${base}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    });
    const pub = await publishRes.json();
    if (pub.error) throw new Error(pub.error.message);
    return { success: true, postId: pub.id };

  } catch (err: any) {
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
  const base = `https://graph.facebook.com/v21.0`;

  try {
    if (contentType === "video" || contentType === "reel") {
      const r = await fetch(`${base}/${pageId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: mediaUrl, description: caption, access_token: token }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message);
      return { success: true, postId: d.id };
    }

    if (mediaUrl) {
      const r = await fetch(`${base}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: mediaUrl, caption, access_token: token }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message);
      return { success: true, postId: d.post_id || d.id };
    }

    // Text post
    const r = await fetch(`${base}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: caption, access_token: token }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return { success: true, postId: d.id };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
