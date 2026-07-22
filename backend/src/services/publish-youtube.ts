export async function publishYoutubeVideo(post: any, token: string): Promise<string> {
  // ── Check content type ─────────────────────────────────────────────────
  // YouTube Data API v3 does NOT support creating community posts.
  // Only video/Shorts uploads are supported.
  const contentType = post.content_type || "video";
  if (contentType === "community" || contentType === "text" || contentType === "post") {
    throw new Error(
      "YouTube community/text posts cannot be published via the API. " +
      "YouTube's Data API v3 only supports video and Shorts uploads. " +
      "Please create community posts manually on YouTube."
    );
  }

  if (contentType === "photo" || contentType === "image" || contentType === "carousel") {
    throw new Error(
      "YouTube does not support image/photo posts via the API. " +
      "Only video/Shorts uploads are supported."
    );
  }

  const videoUrl = post.media_urls?.[0] || post.media_url;
  if (!videoUrl) throw new Error("No video URL provided for YouTube. Upload a video first.");

  // 1. Download video from Supabase URL into memory
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`Failed to download video from Supabase: ${videoRes.statusText}`);
  
  const videoBlob = await videoRes.blob();
  
  // 2. Prepare Metadata
  const metadata = {
    snippet: {
      title: (post.title || post.caption || "Untitled Short").substring(0, 100),
      description: post.caption || "",
      tags: ["shorts", "ugc"],
      categoryId: post.youtube_category_id || "22" // Default to People & Blogs
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false
    }
  };

  // 3. Construct Multipart FormData using built-in web API
  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append(
    "file",
    videoBlob,
    "video.mp4"
  );

  // 4. Upload to YouTube API
  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    }
  );

  const uploadData = await uploadRes.json();

  if (!uploadRes.ok) {
    throw new Error(`YouTube API Error: ${uploadData.error?.message || JSON.stringify(uploadData)}`);
  }

  // Return the YouTube Video ID
  return uploadData.id;
}

