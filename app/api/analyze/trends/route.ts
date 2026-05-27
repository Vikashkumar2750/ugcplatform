import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { platform, niche, language, anthropicKey, apifyKey } = await req.json();

    let trendData: unknown[] = [];

    // Scrape trending content with Apify
    if (apifyKey) {
      try {
        // Use Instagram hashtag scraper to get trending content
        const niches = { instagram: "#" + (niche || "India").toLowerCase().replace(/\s/g, ""), youtube: niche || "India" };
        const actorId = platform === "youtube" ? "streamers/youtube-scraper" : "apify/instagram-hashtag-scraper";
        const inputMap: Record<string, unknown> = {
          instagram: { hashtags: [niches.instagram.replace("#", "")], resultsLimit: 20 },
          youtube: { searchKeywords: [`${niche} India 2025`], maxResults: 10 },
        };
        const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inputMap[platform || "instagram"] || inputMap.instagram),
        });
        if (runRes.ok) {
          const run = await runRes.json();
          const runId = run.data?.id;
          if (runId) {
            for (let i = 0; i < 9; i++) {
              await new Promise(r => setTimeout(r, 5000));
              const s = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`)).json();
              if (s.data?.status === "SUCCEEDED") {
                const items = await (await fetch(
                  `https://api.apify.com/v2/datasets/${s.data.defaultDatasetId}/items?token=${apifyKey}&limit=20`
                )).json();
                trendData = items;
                break;
              }
              if (s.data?.status === "FAILED") break;
            }
          }
        }
      } catch {}
    }

    const client = new Anthropic({ apiKey: anthropicKey });
    const isHindi = language === "hi";

    const userPrompt = `Analyze trending content for ${platform} creators in India in the ${niche} niche (2025):

Trending Data: ${JSON.stringify(trendData.slice(0, 10), null, 2).substring(0, 2000)}

Provide JSON:
{
  "trendingFormats": [
    { "format": "format name", "growth": "+X%", "type": "Reel/Carousel/Short/Video", "whyItWorks": "brief explanation" }
  ],
  "trendingTopics": [
    { "topic": "topic name", "searchVolume": "High/Medium/Low", "competition": "High/Medium/Low" }
  ],
  "trendingHashtags": ["#tag1", "#tag2", ...],
  "trendingAudio": ["audio name 1", "audio name 2"] ,
  "seasonalOpportunity": "current month opportunity specific to Indian audience",
  "viralHookFormulas": [
    { "formula": "hook formula", "example": "Hindi/Hinglish example", "emotion": "Curiosity/Fear/Relatability/etc" }
  ]
}`;

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: userPrompt }],
      system: isHindi
        ? "Tu Indian social media trend expert hai. Hinglish mein examples do. JSON format mein jawab."
        : "You are an Indian social media trend expert. JSON format.",
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: responseText };

    return NextResponse.json({ success: true, trends: data });
  } catch (err: any) {
    console.error("[/api/analyze/trends]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
