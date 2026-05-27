import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { platform, niche, language, competitors, profession, apifyKey, anthropicKey } = await req.json();

    let competitorData: Record<string, unknown>[] = [];

    // If known competitors, scrape them
    if (competitors?.length && apifyKey) {
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
          body: JSON.stringify({ startUrls: competitors.map((url: string) => ({ url })), resultsLimit: 10 }),
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
                  `https://api.apify.com/v2/datasets/${s.data.defaultDatasetId}/items?token=${apifyKey}&limit=10`
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

    const client = new Anthropic({ apiKey: anthropicKey });
    const isHindi = language === "hi";
    const systemPrompt = isHindi
      ? "Tu expert social media analyst hai. Hinglish mein jawab de. JSON format mein."
      : "You are an expert social media analyst. Respond in English. JSON format.";

    const userPrompt = `Analyze competitors for this ${platform} creator and provide insights:
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

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: responseText };

    return NextResponse.json({ success: true, competitors: data });
  } catch (err: any) {
    console.error("[/api/analyze/competitors]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
