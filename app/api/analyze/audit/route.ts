import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { profileUrl, platform, niche, language, anthropicKey, apifyKey } = await req.json();
    if (!profileUrl || !anthropicKey) {
      return NextResponse.json({ error: "Missing profileUrl or anthropicKey" }, { status: 400 });
    }

    let profileData: Record<string, unknown> = { url: profileUrl, platform, niche };

    // --- Scrape profile with Apify ---
    if (apifyKey) {
      const actorMap: Record<string, string> = {
        instagram: "apify/instagram-profile-scraper",
        youtube: "streamers/youtube-channel-scraper",
        facebook: "apify/facebook-pages-scraper",
      };
      const actor = actorMap[platform || "instagram"];
      try {
        const runRes = await fetch(`https://api.apify.com/v2/acts/${actor}/runs?token=${apifyKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startUrls: [{ url: profileUrl }],
            resultsLimit: 20,
          }),
        });
        if (runRes.ok) {
          const run = await runRes.json();
          const runId = run.data?.id;
          if (runId) {
            // Poll for completion (max 45s)
            for (let i = 0; i < 9; i++) {
              await new Promise(r => setTimeout(r, 5000));
              const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
              const statusData = await statusRes.json();
              if (statusData.data?.status === "SUCCEEDED") {
                const itemsRes = await fetch(
                  `https://api.apify.com/v2/datasets/${statusData.data.defaultDatasetId}/items?token=${apifyKey}&limit=30`
                );
                const items = await itemsRes.json();
                profileData = { ...profileData, scraped: items[0] || {} };
                break;
              }
              if (statusData.data?.status === "FAILED") break;
            }
          }
        }
      } catch {
        // Proceed with partial data
      }
    }

    // --- AI Audit via Claude ---
    const client = new Anthropic({ apiKey: anthropicKey });
    const systemPrompt = language === "hi"
      ? "Tu ek expert social media content strategist hai jo Indian creators ke liye kaam karta hai. Hinglish mein jawab de. JSON format mein jawab de."
      : "You are an expert social media content strategist for Indian creators. Respond in English. Respond in JSON format.";

    const userPrompt = `Analyze this ${platform} creator profile and give a comprehensive audit:

Profile URL: ${profileUrl}
Niche: ${niche || "Unknown"}
Scraped Data: ${JSON.stringify(profileData.scraped || {}, null, 2).substring(0, 3000)}

Provide a JSON response with:
{
  "engagementRate": "X.X%",
  "benchmark": "brief context about whether ER is good/bad for this niche",
  "followerCount": "formatted number",
  "avgLikes": "formatted number",
  "avgComments": "formatted number",
  "postsAnalyzed": number,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3", "weakness 4"],
  "diagnosis": {
    "hookQuality": "assessment",
    "ctaPresence": "assessment",
    "consistency": "assessment",
    "contentVariety": "assessment",
    "hashtagStrategy": "assessment",
    "captionDepth": "assessment",
    "engagementLoop": "assessment"
  },
  "overallScore": number (0-100),
  "topRecommendation": "single most important action to take"
}`;

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const auditData = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: responseText };

    return NextResponse.json({ success: true, audit: auditData });
  } catch (err: any) {
    console.error("[/api/analyze/audit]", err);
    return NextResponse.json({ error: err.message || "Audit failed" }, { status: 500 });
  }
}
