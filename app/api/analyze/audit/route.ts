import { NextRequest, NextResponse } from "next/server";
import { callLLM, extractJSON, LLMProvider } from "@/lib/llm-call";

export async function POST(req: NextRequest) {
  try {
    const { profileUrl, platform, niche, language, llmKey, llmProvider, scraperKey, scraperProvider, anthropicKey, apifyKey } = await req.json();

    // Support both new (llmKey/llmProvider) and legacy (anthropicKey/apifyKey) params
    const resolvedLLMKey = llmKey || anthropicKey || "";
    const resolvedLLMProvider = (llmProvider || "anthropic") as LLMProvider;
    const resolvedScraperKey = scraperKey || apifyKey || "";
    const resolvedScraperProvider = scraperProvider || "apify";

    if (!profileUrl || !resolvedLLMKey) {
      return NextResponse.json({ error: "Missing profileUrl or AI API key" }, { status: 400 });
    }

    let profileData: Record<string, unknown> = { url: profileUrl, platform, niche };

    // --- Scrape profile ---
    if (resolvedScraperKey && resolvedScraperProvider === "apify") {
      const actorMap: Record<string, string> = {
        instagram: "apify/instagram-profile-scraper",
        youtube: "streamers/youtube-channel-scraper",
        facebook: "apify/facebook-pages-scraper",
      };
      const actor = actorMap[platform || "instagram"];
      try {
        const runRes = await fetch(`https://api.apify.com/v2/acts/${actor}/runs?token=${resolvedScraperKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startUrls: [{ url: profileUrl }], resultsLimit: 20 }),
        });
        if (runRes.ok) {
          const run = await runRes.json();
          const runId = run.data?.id;
          if (runId) {
            for (let i = 0; i < 9; i++) {
              await new Promise(r => setTimeout(r, 5000));
              const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${resolvedScraperKey}`);
              const statusData = await statusRes.json();
              if (statusData.data?.status === "SUCCEEDED") {
                const itemsRes = await fetch(
                  `https://api.apify.com/v2/datasets/${statusData.data.defaultDatasetId}/items?token=${resolvedScraperKey}&limit=30`
                );
                const items = await itemsRes.json();
                profileData = { ...profileData, scraped: items[0] || {} };
                break;
              }
              if (statusData.data?.status === "FAILED") break;
            }
          }
        }
      } catch { /* Proceed with partial data */ }
    }

    const isHindi = language === "hi";
    const system = isHindi
      ? "Tu ek expert social media content strategist hai jo Indian creators ke liye kaam karta hai. Hinglish mein jawab de. JSON format mein jawab de."
      : "You are an expert social media content strategist for Indian creators. Respond in English. Respond in JSON format.";

    const userMessage = `Analyze this ${platform} creator profile and give a comprehensive audit:

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

    const responseText = await callLLM({ llmKey: resolvedLLMKey, llmProvider: resolvedLLMProvider, system, userMessage, maxTokens: 1500 });
    const auditData = extractJSON(responseText) || { raw: responseText };

    return NextResponse.json({ success: true, audit: auditData });
  } catch (err: any) {
    console.error("[/api/analyze/audit]", err);
    return NextResponse.json({ error: err.message || "Audit failed" }, { status: 500 });
  }
}
