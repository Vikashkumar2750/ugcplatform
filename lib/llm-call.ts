/**
 * Unified LLM caller — supports Anthropic, OpenAI, Gemini, Kimi, Ollama
 * All providers are called via HTTP to avoid SDK dependencies
 */

export type LLMProvider = "anthropic" | "openai" | "gemini" | "kimi" | "ollama" | "bedrock";

export interface LLMCallOptions {
  llmKey: string;
  llmProvider: LLMProvider;
  system: string;
  userMessage: string;
  maxTokens?: number;
}

export async function callLLM({ llmKey, llmProvider, system, userMessage, maxTokens = 1500 }: LLMCallOptions): Promise<string> {
  switch (llmProvider) {

    // ── Anthropic (Claude) ─────────────────────────────────────────
    case "anthropic": {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": llmKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-20250514",
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Anthropic API error");
      return data.content?.[0]?.text || "";
    }

    // ── OpenAI (GPT-4o, GPT-4.1) ──────────────────────────────────
    case "openai": {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userMessage },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "OpenAI API error");
      return data.choices?.[0]?.message?.content || "";
    }

    // ── Google Gemini ──────────────────────────────────────────────
    case "gemini": {
      // gemini-2.0-flash-lite = free tier available
      // gemini-2.0-flash = needs billing
      // gemini-1.5-flash = being deprecated
      const models = ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash-latest"];
      let lastError = "";
      for (const model of models) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${llmKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: system }] },
                contents: [{ role: "user", parts: [{ text: userMessage }] }],
                generationConfig: {
                  maxOutputTokens: maxTokens,
                  temperature: 0.7,
                },
                safetySettings: [
                  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                ],
              }),
            }
          );
          const data = await res.json();
          if (!res.ok) {
            // 429 = quota exceeded, 404 = model not found — try next
            lastError = data.error?.message || `Gemini ${model} error (${res.status})`;
            continue;
          }
          const candidate = data.candidates?.[0];
          const finishReason = candidate?.finishReason;
          const text = candidate?.content?.parts?.[0]?.text || "";
          if (!text) {
            if (finishReason === "SAFETY" || finishReason === "OTHER" || !candidate?.content) {
              // Retry without system_instruction
              const res2 = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${llmKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: `${system}\n\n${userMessage}` }] }],
                    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
                  }),
                }
              );
              const data2 = await res2.json();
              const text2 = data2.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (text2) return text2;
            }
            lastError = `Gemini ${model}: empty response (finishReason: ${finishReason || "unknown"})`;
            continue;
          }
          return text;
        } catch (e: any) {
          lastError = e.message;
          continue;
        }
      }
      throw new Error(
        lastError.includes("quota") || lastError.includes("429")
          ? `Gemini quota exceed ho gaya. Google AI Studio mein billing enable karo ya naya free key lo: https://aistudio.google.com/app/apikey`
          : (lastError || "Gemini API failed on all models")
      );
    }

    // ── Kimi (Moonshot) ────────────────────────────────────────────
    case "kimi": {
      const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "moonshot-v1-8k",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userMessage },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Kimi API error");
      return data.choices?.[0]?.message?.content || "";
    }

    // ── Ollama (local) ─────────────────────────────────────────────
    case "ollama": {
      // llmKey is the base URL e.g. http://localhost:11434
      const res = await fetch(`${llmKey}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2",
          stream: false,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userMessage },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ollama API error");
      return data.message?.content || "";
    }

    // ── AWS Bedrock ────────────────────────────────────────────────
    // llmKey format: "AccessKeyId:SecretAccessKey:region" e.g. "AKIA...:secret:us-east-1"
    case "bedrock": {
      const parts = llmKey.split(":");
      if (parts.length < 3) {
        throw new Error("Bedrock key format galat hai. Sahi format: AccessKeyId:SecretKey:region (e.g. AKIA...:secret:us-east-1)");
      }
      const [accessKeyId, secretAccessKey, region = "us-east-1"] = parts;
      const modelId = "anthropic.claude-3-haiku-20240307-v1:0";
      const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`;

      // AWS SigV4 signing
      const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userMessage }],
      });

      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
      const dateStamp = amzDate.slice(0, 8);
      const service = "bedrock";
      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

      // Hash payload
      const bodyHash = await sha256Hex(body);
      const canonicalHeaders = `content-type:application/json\nhost:bedrock-runtime.${region}.amazonaws.com\nx-amz-date:${amzDate}\n`;
      const signedHeaders = "content-type;host;x-amz-date";
      const canonicalRequest = `POST\n/model/${encodeURIComponent(modelId)}/invoke\n\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`;

      const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

      const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
      const signature = await hmacHex(signingKey, stringToSign);

      const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Amz-Date": amzDate,
          Authorization: authHeader,
        },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Bedrock API error (${res.status})`);
      return data.content?.[0]?.text || "";
    }

    default:
      throw new Error(`Unknown LLM provider: ${llmProvider}`);
  }
}

// ── AWS SigV4 helpers ─────────────────────────────────────────────
async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(key: ArrayBuffer | string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = typeof key === "string" ? encoder.encode(`AWS4${key}`) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw", typeof keyData === "string" ? encoder.encode(keyData) : keyData,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacBuf(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyBytes = typeof key === "string" ? encoder.encode(`AWS4${key}`) : new Uint8Array(key as ArrayBuffer);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

async function getSigningKey(secret: string, date: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmacBuf(secret, date);
  const kRegion = await hmacBuf(kDate, region);
  const kService = await hmacBuf(kRegion, service);
  return hmacBuf(kService, "aws4_request");
}

/**
 * Extract JSON from LLM response (handles markdown code blocks)
 */
export function extractJSON(text: string): Record<string, unknown> | null {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code block or bare JSON
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (match) {
      try { return JSON.parse(match[1] || match[0]); } catch {}
    }
    return null;
  }
}
