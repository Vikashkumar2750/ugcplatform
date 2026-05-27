import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { platform, niche, language, profileUrl, anthropicKey } = await req.json();
    if (!anthropicKey) return NextResponse.json({ error: "Missing anthropicKey" }, { status: 400 });

    const client = new Anthropic({ apiKey: anthropicKey });
    const isHindi = language === "hi";

    const systemPrompt = isHindi
      ? `Tu ek expert content writer hai jo Indian creators ke liye shoot-ready scripts likhta hai. 
         Hinglish mein likho (Hindi + English mix). Scripts relatable, engaging, aur actionable honi chahiye.
         JSON format mein jawab do.`
      : `You are an expert content writer creating shoot-ready scripts for Indian creators.
         Write in clear English. Scripts should be relatable, engaging, and actionable.
         Respond in JSON format.`;

    const userPrompt = `Create a 7-day content pipeline for this ${platform} creator:
Profile: ${profileUrl}
Niche: ${niche}
Language: ${isHindi ? "Hinglish (Hindi + English mix)" : "English"}

Generate 7 unique scripts. For each provide:
{
  "scripts": [
    {
      "day": "Day 1 (Monday)",
      "format": "Reel/Carousel/Story/Short",
      "contentPillar": "Education/Entertainment/Inspiration/Promotion",
      "topic": "specific video topic",
      "hook": "first 3-second hook text (grabbing)",
      "hookTrigger": "Curiosity/Fear/Relatability/FOMO/Shock/Authority/Humor",
      "fullScript": "complete shoot-ready script with timestamps\\n[0:00-0:03] Hook\\n[0:03-0:15] Problem\\n[0:15-0:45] Solution\\n[0:45-0:60] CTA",
      "caption": "full caption with emojis and hashtags",
      "firstComment": "hashtags to put in first comment",
      "thumbnailText": "text for thumbnail overlay",
      "estimatedViews": "Low/Medium/High potential"
    }
  ],
  "postingSchedule": [
    { "day": "Monday", "time": "7:00 PM IST", "platform": "${platform}", "format": "Reel" }
  ],
  "contentTheme": "overarching theme for the week"
}

Make all 7 scripts completely different formats and topics. Be specific to the Indian audience.`;

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: responseText };

    return NextResponse.json({ success: true, pipeline: data });
  } catch (err: any) {
    console.error("[/api/analyze/pipeline]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
