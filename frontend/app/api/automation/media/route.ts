import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

async function getUserId(): Promise<string | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch { return null; }
}

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}


// GET — fetch user's Instagram or Facebook recent media posts
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accountId = req.nextUrl.searchParams.get("accountId");
  const supabase = getServiceClient();

  let query = supabase
    .from("connected_accounts")
    .select("access_token, platform_user_id, platform")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (accountId) {
    query = query.eq("id", accountId);
  } else {
    // Fallback to first instagram account if none specified
    query = query.eq("platform", "instagram");
  }

  const { data: connection } = await query.limit(1).single();

  if (!connection?.access_token) {
    return NextResponse.json({ error: "Account not connected or not found", media: [] });
  }

  try {
    let url = "";
    if (connection.platform === "facebook") {
      // Fetch recent 20 posts from Facebook Page
      const fields = "id,message,created_time,full_picture,permalink_url,attachments{media_type,media}";
      url = `https://graph.facebook.com/v21.0/${connection.platform_user_id}/published_posts?fields=${fields}&limit=20&access_token=${connection.access_token}`;
    } else {
      // Fetch recent 20 media from Instagram Graph API
      const fields = "id,media_type,media_url,thumbnail_url,caption,timestamp,permalink";
      url = `https://graph.facebook.com/v21.0/${connection.platform_user_id}/media?fields=${fields}&limit=20&access_token=${connection.access_token}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message, media: [] });
    }

    let media = [];
    if (connection.platform === "facebook") {
      media = (data.data || []).map((m: any) => {
        const attachment = m.attachments?.data?.[0];
        const isVideo = attachment?.media_type === "video";
        return {
          id: m.id,
          type: isVideo ? "VIDEO" : (attachment?.media_type === "photo" ? "IMAGE" : "CAROUSEL_ALBUM"),
          url: m.full_picture || "",
          thumbnail: m.full_picture || "",
          caption: m.message?.substring(0, 100) || "",
          timestamp: m.created_time,
          permalink: m.permalink_url,
        };
      });
    } else {
      media = (data.data || []).map((m: any) => {
        const isVideo = m.media_type === "VIDEO" || m.media_type === "REEL";
        return {
          id: m.id,
          type: m.media_type,
          url: isVideo ? (m.thumbnail_url || m.media_url || "") : (m.media_url || ""),
          thumbnail: m.thumbnail_url || m.media_url || "",
          caption: m.caption?.substring(0, 100) || "",
          timestamp: m.timestamp,
          permalink: m.permalink,
        };
      });
    }

    return NextResponse.json({ media });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, media: [] });
  }
}
