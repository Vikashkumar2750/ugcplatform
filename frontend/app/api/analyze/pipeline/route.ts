import { NextRequest, NextResponse } from "next/server";
import { callLLM, extractJSON, LLMProvider } from "@/lib/llm-call";

export async function POST(req: NextRequest) {
  try {
    const { platform, niche, language, profileUrl, llmKey, llmProvider, anthropicKey } = await req.json();

    const resolvedLLMKey = llmKey || anthropicKey || "";
    const resolvedLLMProvider = (llmProvider || "anthropic") as LLMProvider;

    if (!resolvedLLMKey) {
      return NextResponse.json({ error: "Missing AI API key" }, { status: 400 });
    }

    const isHindi = language === "hi";
    const system = isHindi
      ? `Tu ek expert content writer hai jo Indian creators ke liye shoot-ready scripts likhta hai. 
         Hinglish mein likho (Hindi + English mix). Scripts relatable, engaging, aur actionable honi chahiye.
         JSON format mein jawab do.`
      : `You are an expert content writer creating shoot-ready scripts for Indian creators.
         Write in clear English. Scripts should be relatable, engaging, and actionable.
         Respond in JSON format.`;

    const userMessage = `Create a 7-day content pipeline for this ${platform} creator:
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

    const responseText = await callLLM({ llmKey: resolvedLLMKey, llmProvider: resolvedLLMProvider, system, userMessage, maxTokens: 8000 });
    const data = extractJSON(responseText) || { raw: responseText };

    return NextResponse.json({ success: true, pipeline: data });
  } catch (err: any) {
    console.error("[/api/analyze/pipeline]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
