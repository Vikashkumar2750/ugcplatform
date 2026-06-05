import { supabase } from "../lib/supabase";
import { decrypt } from "./crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LLMRequest {
  userId: string;
  endpoint: string;           // 'audit' | 'competitors' | 'hashtags' | 'ideas'
  prompt: string;
  systemPrompt?: string;
  preferProvider?: string;    // force a specific provider
}

export interface LLMResponse {
  text: string;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  const { userId, endpoint, prompt, systemPrompt } = req;

  // 1. Check if user has own keys (preferred)
  const { data: keyRows } = await supabase
    .from("user_api_keys")
    .select("provider, encrypted_key")
    .eq("user_id", userId)
    .eq("is_active", true);

  const userKeys: Record<string, string> = {};
  for (const row of keyRows || []) {
    try {
      userKeys[row.provider] = decrypt(row.encrypted_key);
    } catch {
      // Skip corrupted keys
    }
  }

  // 2. Check platform API permission
  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_api_allowed")
    .eq("id", userId)
    .single();

  const platformAllowed = profile?.platform_api_allowed !== false;

  // 3. Provider priority: user's own key → platform Gemini → blocked
  let response: LLMResponse;

  if (userKeys.gemini && (req.preferProvider === "gemini" || !req.preferProvider)) {
    response = await callGemini(userKeys.gemini, prompt, systemPrompt, "user_own");
  } else if (userKeys.anthropic && req.preferProvider === "anthropic") {
    response = await callAnthropic(userKeys.anthropic, prompt, systemPrompt, "user_own");
  } else if (userKeys.openai && req.preferProvider === "openai") {
    response = await callOpenAI(userKeys.openai, prompt, systemPrompt, "user_own");
  } else if (userKeys.bedrock && req.preferProvider === "bedrock") {
    response = await callBedrock(userKeys.bedrock, prompt, systemPrompt, "user_own");
  } else if (userKeys.gemini) {
    // Fallback to user's gemini even if another provider was preferred
    response = await callGemini(userKeys.gemini, prompt, systemPrompt, "user_own");
  } else if (platformAllowed && process.env.GEMINI_API_KEY) {
    // Platform fallback — use platform's Gemini key
    response = await callGemini(
      process.env.GEMINI_API_KEY,
      prompt,
      systemPrompt,
      "platform"
    );
  } else {
    throw new Error(
      "Platform AI access is not available for your account. Please add your own API key in Settings."
    );
  }

  // 4. Log usage
  await supabase.from("api_usage_logs").insert({
    user_id: userId,
    provider: response.provider,
    endpoint,
    key_source: response.provider === "gemini" && !userKeys.gemini ? "platform" : "user_own",
    tokens_input: response.tokensInput,
    tokens_output: response.tokensOutput,
    tokens_total: response.tokensInput + response.tokensOutput,
    cost_usd: estimateCost(response.provider, response.tokensInput, response.tokensOutput),
  });

  // 5. Update last_used_at for the key
  const usedProvider = response.provider;
  if (userKeys[usedProvider]) {
    await supabase
      .from("user_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("provider", usedProvider);
  }

  return response;
}

// ─── Provider implementations ─────────────────────────────────────────────────

async function callGemini(
  apiKey: string,
  prompt: string,
  systemPrompt: string | undefined,
  _source: string
): Promise<LLMResponse> {
  const model = "gemini-2.0-flash-lite";
  const contents: any[] = [];

  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Understood." }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Gemini error: ${err.error?.message || res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usage = data.usageMetadata || {};

  return {
    text,
    provider: "gemini",
    model,
    tokensInput: usage.promptTokenCount || 0,
    tokensOutput: usage.candidatesTokenCount || 0,
  };
}

async function callAnthropic(
  apiKey: string,
  prompt: string,
  systemPrompt: string | undefined,
  _source: string
): Promise<LLMResponse> {
  const model = "claude-3-haiku-20240307";
  const body: any = {
    model,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Anthropic error: ${err.error?.message || res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const usage = data.usage || {};

  return {
    text,
    provider: "anthropic",
    model,
    tokensInput: usage.input_tokens || 0,
    tokensOutput: usage.output_tokens || 0,
  };
}

async function callOpenAI(
  apiKey: string,
  prompt: string,
  systemPrompt: string | undefined,
  _source: string
): Promise<LLMResponse> {
  const model = "gpt-4o-mini";
  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, max_tokens: 2048 }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`OpenAI error: ${err.error?.message || res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  const usage = data.usage || {};

  return {
    text,
    provider: "openai",
    model,
    tokensInput: usage.prompt_tokens || 0,
    tokensOutput: usage.completion_tokens || 0,
  };
}

async function callBedrock(
  bearerToken: string,
  prompt: string,
  systemPrompt: string | undefined,
  _source: string
): Promise<LLMResponse> {
  // AWS Bedrock with IAM Identity Center bearer token
  const model = "anthropic.claude-3-haiku-20240307-v1:0";
  const region = process.env.AWS_REGION || "us-east-1";

  const body: any = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch(
    `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/invoke`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bedrock error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const usage = data.usage || {};

  return {
    text,
    provider: "bedrock",
    model,
    tokensInput: usage.input_tokens || 0,
    tokensOutput: usage.output_tokens || 0,
  };
}

// ─── Cost estimation ──────────────────────────────────────────────────────────

function estimateCost(
  provider: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Cost per million tokens (approximate, as of 2025)
  const rates: Record<string, { input: number; output: number }> = {
    gemini: { input: 0.075, output: 0.3 },          // gemini-2.0-flash-lite
    anthropic: { input: 0.25, output: 1.25 },        // claude-3-haiku
    openai: { input: 0.15, output: 0.6 },             // gpt-4o-mini
    bedrock: { input: 0.25, output: 1.25 },           // claude-3-haiku via bedrock
  };

  const rate = rates[provider] || { input: 0, output: 0 };
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}
