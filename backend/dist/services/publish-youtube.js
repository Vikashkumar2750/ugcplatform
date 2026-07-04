"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishYoutubeVideo = publishYoutubeVideo;
async function publishYoutubeVideo(post, token) {
    const videoUrl = post.media_urls?.[0];
    if (!videoUrl)
        throw new Error("No video URL provided for YouTube");
    // 1. Download video from Supabase URL into memory
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok)
        throw new Error(`Failed to download video from Supabase: ${videoRes.statusText}`);
    const videoBlob = await videoRes.blob();
    // 2. Prepare Metadata
    const metadata = {
        snippet: {
            title: post.caption.substring(0, 100) || "Untitled Short",
            description: post.caption,
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
    formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    formData.append("file", videoBlob, "video.mp4");
    // 4. Upload to YouTube API
    const uploadRes = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`
        },
        body: formData
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
        throw new Error(`YouTube API Error: ${uploadData.error?.message || JSON.stringify(uploadData)}`);
    }
    // Return the YouTube Video ID
    return uploadData.id;
}
//# sourceMappingURL=publish-youtube.js.map