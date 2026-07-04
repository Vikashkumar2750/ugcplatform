"use strict";
// Removed types for simplicity, using any
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishLinkedinPost = publishLinkedinPost;
async function uploadLinkedinImage(authorUrn, mediaUrl, token) {
    // 1. Initialize upload
    const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "LinkedIn-Version": "2024-01"
        },
        body: JSON.stringify({
            initializeUploadRequest: {
                owner: authorUrn
            }
        })
    });
    if (!initRes.ok) {
        const err = await initRes.text();
        throw new Error(`Failed to initialize LinkedIn image upload: ${err}`);
    }
    const initData = await initRes.json();
    const uploadUrl = initData.value.uploadUrl;
    const imageUrn = initData.value.image;
    // 2. Fetch media from our URL
    const mediaRes = await fetch(mediaUrl);
    const mediaBuffer = await mediaRes.arrayBuffer();
    // 3. Upload bytes
    const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": "application/octet-stream",
            "Authorization": `Bearer ${token}` // Sometimes required, sometimes not, but safe to include
        },
        body: mediaBuffer
    });
    if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error(`Failed to upload LinkedIn image bytes: ${err}`);
    }
    return imageUrn;
}
async function uploadLinkedinVideo(authorUrn, mediaUrl, token) {
    // 1. Initialize upload
    const initRes = await fetch("https://api.linkedin.com/rest/videos?action=initializeUpload", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "LinkedIn-Version": "2024-01"
        },
        body: JSON.stringify({
            initializeUploadRequest: {
                owner: authorUrn,
                fileSizeBytes: 0, // Not strictly enforced for basic uploads, but ideally we'd pass the actual size
                uploadCaptions: false,
                uploadThumbnail: false
            }
        })
    });
    if (!initRes.ok) {
        const err = await initRes.text();
        throw new Error(`Failed to initialize LinkedIn video upload: ${err}`);
    }
    const initData = await initRes.json();
    // Video init payload can be slightly different depending on version, usually value.uploadInstructions[0].uploadUrl
    const uploadInstructions = initData.value.uploadInstructions;
    const uploadUrl = uploadInstructions[0].uploadUrl;
    const videoUrn = initData.value.video;
    // 2. Fetch media
    const mediaRes = await fetch(mediaUrl);
    const mediaBuffer = await mediaRes.arrayBuffer();
    // 3. Upload bytes (must use exact headers provided in instructions, or generic stream)
    const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": "application/octet-stream"
        },
        body: mediaBuffer
    });
    if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error(`Failed to upload LinkedIn video bytes: ${err}`);
    }
    return videoUrn;
}
async function publishLinkedinPost(post, token) {
    const account = post.connected_accounts;
    const authorUrn = account.platform_user_id; // e.g. urn:li:person:123 or urn:li:organization:123
    const postBody = {
        author: authorUrn,
        commentary: post.caption || "",
        visibility: "PUBLIC",
        distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: []
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false
    };
    // Handle Media
    if (post.media_url) {
        try {
            const isVideo = post.media_url.match(/\.(mp4|mov|avi|wmv)$/i) || post.media_url.includes("/video/");
            let mediaUrn = "";
            if (isVideo) {
                mediaUrn = await uploadLinkedinVideo(authorUrn, post.media_url, token);
            }
            else {
                mediaUrn = await uploadLinkedinImage(authorUrn, post.media_url, token);
            }
            postBody.content = {
                media: {
                    id: mediaUrn
                }
            };
        }
        catch (error) {
            console.error("LinkedIn Media Upload Error:", error);
            throw new Error(`Media Upload Failed: ${error.message}`);
        }
    }
    // Create Post
    const res = await fetch("https://api.linkedin.com/rest/posts", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "LinkedIn-Version": "2024-01",
            "X-Restli-Protocol-Version": "2.0.0"
        },
        body: JSON.stringify(postBody)
    });
    if (!res.ok) {
        const errorData = await res.text();
        console.error("LinkedIn Post Error:", errorData);
        throw new Error(`LinkedIn API Error: ${errorData}`);
    }
    const postId = res.headers.get("x-restli-id");
    console.log(`Successfully published to LinkedIn: ${postId}`);
    return postId || "unknown_post_id";
}
//# sourceMappingURL=publish-linkedin.js.map