import { NextRequest, NextResponse } from "next/server";
import { callLLM, extractJSON, LLMProvider } from "@/lib/llm-call";

export async function POST(req: NextRequest) {
  try {
    const { platform, niche, language, competitors, profession, llmKey, llmProvider, scraperKey, scraperProvider, anthropicKey, apifyKey } = await req.json();

    const resolvedLLMKey = llmKey || anthropicKey || "";
    const resolvedLLMProvider = (llmProvider || "anthropic") as LLMProvider;
    const resolvedScraperKey = scraperKey || apifyKey || "";
    const resolvedScraperProvider = scraperProvider || "apify";

    let competitorData: Record<string, unknown>[] = [];

    // If known competitors, scrape them via Apify
    if (competitors?.length && resolvedScraperKey && resolvedScraperProvider === "apify") {
      const actorMap: Record<string, string> = {
        instagram: "apify/instagram-scraper",
        youtube: "streamers/youtube-channel-scraper",
        facebook: "apify/facebook-pages-scraper",
      };
      const actor = actorMap[platform || "instagram"];
      try {
        const runRes = await fetch(`https://api.apify.com/v2/acts/${actor}/runs?token=${resolvedScraperKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startUrls: competitors.map((url: string) => ({ url })), resultsLimit: 10 }),
        });
        if (runRes.ok) {
          const run = await runRes.json();
          const runId = run.data?.id;
          if (runId) {
            for (let i = 0; i < 9; i++) {
              await new Promise(r => setTimeout(r, 5000));
              const s = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${resolvedScraperKey}`)).json();
              if (s.data?.status === "SUCCEEDED") {
                const items = await (await fetch(
                  `https://api.apify.com/v2/datasets/${s.data.defaultDatasetId}/items?token=${resolvedScraperKey}&limit=10`
                )).json();
                competitorData = items;
                break;
              }
              if (s.data?.status === "FAILED") break;
            }
          }
        }
      } catch {}
    }

    const isHindi = language === "hi";
    const system = isHindi
      ? "Tu expert social media analyst hai. Hinglish mein jawab de. JSON format mein."
      : "You are an expert social media analyst. Respond in English. JSON format.";

    const userMessage = `Analyze competitors for this ${platform} creator and provide insights:
Niche: ${niche}
${profession ? `Creator's background: ${profession}` : ""}
Known Competitors: ${competitors?.join(", ") || "None provided — discover top 3"}
Scraped Data: ${JSON.stringify(competitorData.slice(0, 2), null, 2).substring(0, 2000)}

Provide JSON:
{
  "competitors": [
    {
      "handle": "@handle",
      "platform": "${platform}",
      "followers": "formatted",
      "engagementRate": "X.X%",
      "avgViews": "formatted",
      "whatTheyDoWell": ["point 1", "point 2", "point 3"],
      "hookStyle": "description",
      "postingFrequency": "X/week",
      "captionStyle": "description",
      "topHashtags": ["#tag1", "#tag2", "#tag3"]
    }
  ],
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "gapsToExploit": ["gap 1", "gap 2", "gap 3"],
  "recommendedNiche": "${niche || "suggested niche"}",
  "recommendedSubNiche": "more specific sub-niche"
}`;

    const responseText = await callLLM({ llmKey: resolvedLLMKey, llmProvider: resolvedLLMProvider, system, userMessage, maxTokens: 2000 });
    const data = extractJSON(responseText) || { raw: responseText };

    return NextResponse.json({ success: true, competitors: data });
  } catch (err: any) {
    console.error("[/api/analyze/competitors]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
