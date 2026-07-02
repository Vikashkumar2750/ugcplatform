import { supabase } from "../lib/supabase";
import { decrypt } from "./crypto";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";


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

// ─── Placeholder Detection & Stripping ────────────────────────────────────────

/** Patterns that indicate LLM returned placeholder/template content instead of real output */
const PLACEHOLDER_PATTERNS = [
  /\[Your\s+\w+\]/gi,          // [Your Name], [Your Product]
  /\[Insert\s+\w+.*?\]/gi,     // [Insert link here], [Insert Name]
  /\[Niche\]/gi,
  /\[Topic\]/gi,
  /\[Brand\]/gi,
  /\[Product\s*Name\]/gi,
  /\[Link\]/gi,
  /\[CTA\]/gi,
  /\[Name\]/gi,
  /\[City\]/gi,
  /\[Number\]/gi,
  /\[X+\]/g,                    // [XXX], [XXXX]
  /\[fill\s+in.*?\]/gi,
  /\[add\s+.*?\]/gi,
  /\[mention\s+.*?\]/gi,
  /\[specify\s+.*?\]/gi,
  /\[enter\s+.*?\]/gi,
];

/**
 * Check if LLM text contains placeholder brackets.
 * Returns the count of placeholders found.
 */
export function countPlaceholders(text: string): number {
  let count = 0;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Remove common placeholder brackets from LLM output.
 * Replaces [Your Name] → "aapka naam", [Link] → "link in bio" etc.
 */
export function stripPlaceholders(text: string): string {
  const replacements: [RegExp, string][] = [
    [/\[Your\s+Name\]/gi, "aapka naam"],
    [/\[Your\s+Brand\]/gi, "aapka brand"],
    [/\[Your\s+Product\]/gi, "aapka product"],
    [/\[Insert\s+link.*?\]/gi, "link in bio"],
    [/\[Niche\]/gi, "content creation"],
    [/\[Topic\]/gi, "trending topic"],
    [/\[Brand\]/gi, "brand"],
    [/\[Product\s*Name\]/gi, "product"],
    [/\[Link\]/gi, "link in bio"],
    [/\[CTA\]/gi, "comment karo"],
    [/\[Name\]/gi, "doston"],
    [/\[City\]/gi, "city"],
    [/\[Number\]/gi, "bohot saare"],
    [/\[X+\]/g, "100+"],
    [/\[fill\s+in.*?\]/gi, ""],
    [/\[add\s+.*?\]/gi, ""],
    [/\[mention\s+.*?\]/gi, ""],
    [/\[specify\s+.*?\]/gi, ""],
    [/\[enter\s+.*?\]/gi, ""],
  ];

  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  const { userId, endpoint, prompt, systemPrompt } = req;

  // 1. Fetch user's own API keys (decrypted)
  const { data: keyRows } = await supabase
    .from("user_api_keys")
    .select("provider, encrypted_key")
    .eq("user_id", userId)
    .eq("is_active", true);

  const userKeys: Record<string, string> = {};
  for (const row of keyRows || []) {
    try { userKeys[row.provider] = decrypt(row.encrypted_key); } catch {}
  }

  // 2. Check platform API permission
  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_api_allowed")
    .eq("id", userId)
    .maybeSingle();

  const platformAllowed = profile?.platform_api_allowed !== false;

  // 3. Build ordered list of (key, provider, source) to try
  const attempts: Array<() => Promise<LLMResponse>> = [];

  // ── Ollama LOCAL (highest priority — free, no API key needed) ─────────────
  const ollamaUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").trim();
  const ollamaModel = (process.env.OLLAMA_MODEL || "llama3.1:8b").trim();
  // Always try Ollama first in local dev (NODE_ENV !== production)
  if (process.env.NODE_ENV !== "production" || process.env.OLLAMA_BASE_URL) {
    attempts.push(() => callOllama(ollamaUrl, ollamaModel, prompt, systemPrompt));
  }

  // ── User's own keys (next priority) ──────────────────────────────────────
  if (req.preferProvider === "anthropic" && userKeys.anthropic) {
    attempts.push(() => callAnthropic(userKeys.anthropic, prompt, systemPrompt, "user_own"));
  }
  if (req.preferProvider === "openai" && userKeys.openai) {
    attempts.push(() => callOpenAI(userKeys.openai, prompt, systemPrompt, "user_own"));
  }
  if (req.preferProvider === "openrouter" && userKeys.openrouter) {
    attempts.push(() => callOpenRouter(userKeys.openrouter, prompt, systemPrompt, "user_own"));
  }
  if (req.preferProvider === "bedrock" && userKeys.bedrock) {
    attempts.push(() => callBedrock(undefined, undefined, userKeys.bedrock, prompt, systemPrompt, "user_own"));
  }
  // User Gemini always available as user-key option
  if (userKeys.gemini) {
    attempts.push(() => callGemini(userKeys.gemini, prompt, systemPrompt, "user_own"));
  }
  // OpenRouter — unified access to many models
  if (userKeys.openrouter && req.preferProvider !== "openrouter") {
    attempts.push(() => callOpenRouter(userKeys.openrouter, prompt, systemPrompt, "user_own"));
  }
  // User's other keys as further fallback
  if (userKeys.anthropic && req.preferProvider !== "anthropic") {
    attempts.push(() => callAnthropic(userKeys.anthropic, prompt, systemPrompt, "user_own"));
  }
  if (userKeys.openai && req.preferProvider !== "openai") {
    attempts.push(() => callOpenAI(userKeys.openai, prompt, systemPrompt, "user_own"));
  }
  if (userKeys.bedrock && req.preferProvider !== "bedrock") {
    attempts.push(() => callBedrock(undefined, undefined, userKeys.bedrock, prompt, systemPrompt, "user_own"));
  }

  // ── Platform keys (if user has no working key / platform allowed) ─────────
  if (platformAllowed) {
    // Gemini first — free tier, reliable
    if (process.env.GEMINI_API_KEY) {
      attempts.push(() => callGemini(process.env.GEMINI_API_KEY!, prompt, systemPrompt, "platform"));
    }
    // Anthropic Claude as secondary platform key
    if (process.env.ANTHROPIC_API_KEY) {
      attempts.push(() => callAnthropic(process.env.ANTHROPIC_API_KEY!, prompt, systemPrompt, "platform"));
    }
    // Bedrock via standard AWS access key + secret key (preferred) OR old bearer token
    const awsKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    const bedrockBearer = process.env.AWS_BEARER_TOKEN_BEDROCK?.trim();
    if (awsKeyId && awsSecret) {
      attempts.push(() => callBedrock(awsKeyId, awsSecret, undefined, prompt, systemPrompt, "platform"));
    } else if (bedrockBearer) {
      attempts.push(() => callBedrock(undefined, undefined, bedrockBearer, prompt, systemPrompt, "platform"));
    }
  }

  if (attempts.length === 0) {
    throw new Error(
      "No AI provider configured. " +
      "Either add GEMINI_API_KEY to Render environment, or add your API key in Settings → API Keys."
    );
  }

  // 4. Try each provider in order — stop at first success
  let lastError: Error | null = null;
  let response: LLMResponse | null = null;

  for (const attempt of attempts) {
    try {
      response = await attempt();
      break; // success
    } catch (err: any) {
      console.warn(`[LLM] Provider failed: ${err.message?.slice(0, 100)}`);
      lastError = err;
    }
  }

  if (!response) {
    throw new Error(
      lastError?.message ||
      "All AI providers failed. Please add your own API key in Settings → API Keys."
    );
  }

  // 5. Determine key source for logging
  const keySource = userKeys[response.provider] ? "user_own" : "platform";

  // 6. Log usage (non-fatal)
  try {
    await supabase.from("api_usage_logs").insert({
      user_id: userId,
      provider: response.provider,
      endpoint,
      key_source: keySource,
      tokens_input: response.tokensInput,
      tokens_output: response.tokensOutput,
      tokens_total: response.tokensInput + response.tokensOutput,
      cost_usd: estimateCost(response.provider, response.tokensInput, response.tokensOutput),
    });
  } catch { /* non-fatal */ }

  // 7. Update last_used_at for the key used (non-fatal)
  if (keySource === "user_own") {
    try {
      await supabase
        .from("user_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("provider", response.provider);
    } catch { /* non-fatal */ }
  }

  return response;
}


// ─── Provider implementations ─────────────────────────────────────────────────

// Models tried in order — each has its own independent quota bucket
const GEMINI_MODELS = [
  "gemini-2.0-flash",                 // Stable, good quota
  "gemini-2.0-flash-lite",            // Lighter, more quota
  "gemini-2.5-flash-preview-05-20",   // Latest but may hit quota
  "gemini-1.5-flash",                 // Older stable
];

async function callGeminiModel(
  apiKey: string,
  model: string,
  prompt: string,
  systemPrompt: string | undefined
): Promise<LLMResponse> {
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
    const msg = err.error?.message || String(res.status);
    throw new Error(`Gemini error: ${msg}`);
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

// Returns true for errors that mean "try another model"
function isSkippableGeminiError(msg: string): boolean {
  return (
    msg.includes("quota") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("429") ||
    msg.includes("not found") ||
    msg.includes("not supported") ||
    msg.includes("not_found") ||
    msg.includes("deprecated") ||
    msg.includes("limit")
  );
}

async function callGemini(
  apiKey: string,
  prompt: string,
  systemPrompt: string | undefined,
  _source: string
): Promise<LLMResponse> {
  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    try {
      const result = await callGeminiModel(apiKey, model, prompt, systemPrompt);
      console.log(`[LLM] Gemini success with model: ${model}`);
      return result;
    } catch (err: any) {
      if (isSkippableGeminiError(err.message || "")) {
        console.warn(`[LLM] Gemini ${model} skipped: ${err.message?.slice(0, 80)}`);
        lastError = err;
        continue;
      }
      // Auth error or other fatal — stop immediately
      throw err;
    }
  }

  throw new Error(
    "All Gemini models are unavailable (quota/not-found). " +
    "Please add your own Gemini API key in Settings → API Keys."
  );
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
    max_tokens: 4096,
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
    body: JSON.stringify({ model, messages, max_tokens: 4096 }),
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

// ─── Ollama (local) ───────────────────────────────────────────────────────────
async function callOllama(
  baseUrl: string,
  model: string,
  prompt: string,
  systemPrompt: string | undefined
): Promise<LLMResponse> {
  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  // Try the configured model first, then fall back to 3b if not found
  const modelsToTry = model === "llama3.2:3b" ? [model] : [model, "llama3.2:3b"];

  for (const tryModel of modelsToTry) {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: tryModel,
        messages,
        stream: false,
        options: { num_predict: 4096 },   // Max tokens
      }),
      signal: AbortSignal.timeout(300000), // 5 min — local models can be slow
    });

    if (!res.ok) {
      const err = await res.text();
      const msg = `Ollama error ${res.status}: ${err.substring(0, 200)}`;
      // 404 = model not installed, try next fallback
      if (res.status === 404 && tryModel !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[LLM] Ollama model ${tryModel} not found, trying next...`);
        continue;
      }
      throw new Error(msg);
    }

    const data = await res.json();
    // Ollama sometimes returns 200 with error in body (e.g. empty output)
    if (data.error) {
      const errMsg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
      // "model output must contain..." = empty generation, try next model
      if (errMsg.includes("model output must contain") && tryModel !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[LLM] Ollama ${tryModel} empty output, trying next model...`);
        continue;
      }
      throw new Error(`Ollama error: ${errMsg.substring(0, 150)}`);
    }

    const text = data.choices?.[0]?.message?.content || "";
    if (!text) throw new Error(`Ollama returned empty response for model: ${tryModel}`);

    const usage = data.usage || {};
    console.log(`[LLM] Ollama success: ${tryModel} @ ${baseUrl}`);
    return {
      text,
      provider: "ollama",
      model: tryModel,
      tokensInput: usage.prompt_tokens || 0,
      tokensOutput: usage.completion_tokens || 0,
    };
  }
  throw new Error("Ollama: all models unavailable");
}

const BEDROCK_MODELS = [
  "amazon.nova-micro-v1:0",             // Amazon Nova Micro — fastest, cheapest
  "amazon.nova-lite-v1:0",              // Amazon Nova Lite — balanced
  "anthropic.claude-3-haiku-20240307-v1:0",       // Claude 3 Haiku — if enabled
  "anthropic.claude-3-5-haiku-20241022-v1:0",      // Claude 3.5 Haiku — newer
  // amazon.titan-text-lite-v1 — EOL, removed
];

async function callBedrockModel(
  accessKeyId: string | undefined,
  secretAccessKey: string | undefined,
  bearerToken: string | undefined,
  model: string,
  prompt: string,
  systemPrompt: string | undefined
): Promise<LLMResponse> {
  const region = (process.env.AWS_REGION || "us-east-1").trim();
  const isNova = model.includes("nova");
  const isTitan = model.includes("titan");

  // ── Prefer AWS SDK (standard SigV4 with access key + secret) ─────────────
  if (accessKeyId && secretAccessKey) {
    const client = new BedrockRuntimeClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    let requestBody: any;
    if (isNova) {
      requestBody = {
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 8192 },
        ...(systemPrompt ? { system: [{ text: systemPrompt }] } : {}),
      };
    } else if (isTitan) {
      requestBody = {
        inputText: `${systemPrompt ? systemPrompt + "\n\n" : ""}${prompt}`,
        textGenerationConfig: { maxTokenCount: 4096 },
      };
    } else {
      // Claude format
      requestBody = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
        ...(systemPrompt ? { system: systemPrompt } : {}),
      };
    }

    const command = new InvokeModelCommand({
      modelId: model,
      body: JSON.stringify(requestBody),
      contentType: "application/json",
      accept: "application/json",
    });

    const response = await client.send(command);
    const data = JSON.parse(new TextDecoder().decode(response.body));

    const text = isNova
      ? (data.output?.message?.content?.[0]?.text || "")
      : isTitan
      ? (data.results?.[0]?.outputText || "")
      : (data.content?.[0]?.text || "");

    const usage = data.usage || {};
    return {
      text, provider: "bedrock", model,
      tokensInput: usage.inputTokens || usage.input_tokens || 0,
      tokensOutput: usage.outputTokens || usage.output_tokens || 0,
    };
  }

  // ── Fallback: old bearer token (HTTP Authorization header) ────────────────
  if (!bearerToken) throw new Error("Bedrock: no credentials provided");
  const cleanToken = bearerToken.trim();

  const requestBody = isNova
    ? { messages: [{ role: "user", content: [{ text: prompt }] }], inferenceConfig: { maxTokens: 8192 }, ...(systemPrompt ? { system: [{ text: systemPrompt }] } : {}) }
    : { anthropic_version: "bedrock-2023-05-31", max_tokens: 8192, messages: [{ role: "user", content: prompt }], ...(systemPrompt ? { system: systemPrompt } : {}) };

  const res = await fetch(
    `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/invoke`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${cleanToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(requestBody),
    }
  );
  if (!res.ok) { const errText = await res.text(); throw new Error(`Bedrock error ${res.status}: ${errText}`); }
  const data = await res.json();
  const text = isNova ? (data.output?.message?.content?.[0]?.text || "") : (data.content?.[0]?.text || "");
  const usage = data.usage || {};
  return {
    text, provider: "bedrock", model,
    tokensInput: usage.inputTokens || usage.input_tokens || 0,
    tokensOutput: usage.outputTokens || usage.output_tokens || 0,
  };
}

async function callBedrock(
  accessKeyId: string | undefined,
  secretAccessKey: string | undefined,
  bearerToken: string | undefined,
  prompt: string,
  systemPrompt: string | undefined,
  _source: string
): Promise<LLMResponse> {
  let lastError: Error | null = null;

  for (const model of BEDROCK_MODELS) {
    try {
      const result = await callBedrockModel(accessKeyId, secretAccessKey, bearerToken, model, prompt, systemPrompt);
      console.log(`[LLM] Bedrock success with model: ${model}`);
      return result;
    } catch (err: any) {
      const isSkippable =
        err.message?.includes("Legacy") ||
        err.message?.includes("deprecated") ||
        err.message?.includes("not found") ||
        err.message?.includes("Access denied") ||
        err.message?.includes("404") ||
        err.message?.includes("throttl") ||
        err.message?.includes("quota") ||
        err.message?.includes("quarantine") ||
        err.message?.includes("QuarantineV3") ||
        err.message?.includes("model output must contain") ||  // Nova empty response
        err.message?.includes("explicit deny") ||              // IAM deny
        err.message?.includes("403");                          // Any 403 = try next

      if (isSkippable) {
        console.warn(`[LLM] Bedrock ${model} skipped: ${err.message?.slice(0, 80)}`);
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw new Error(`All Bedrock models failed. Last error: ${lastError?.message?.slice(0, 100)}`);
}


// ─── OpenRouter (unified access to GPT-4o, Claude, Llama, etc.) ───────────────

async function callOpenRouter(
  apiKey: string,
  prompt: string,
  systemPrompt: string | undefined,
  _source: string
): Promise<LLMResponse> {
  const model = "google/gemini-2.0-flash-exp:free"; // Free tier first, falls back to paid
  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://contentengineer.techaasvik.in",
      "X-Title": "Content Engineer",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`OpenRouter error: ${err.error?.message || res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  const usage = data.usage || {};
  const actualModel = data.model || model;

  return {
    text,
    provider: "openrouter",
    model: actualModel,
    tokensInput: usage.prompt_tokens || 0,
    tokensOutput: usage.completion_tokens || 0,
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
    openrouter: { input: 0.0, output: 0.0 },          // free tier
    bedrock: { input: 0.25, output: 1.25 },           // claude-3-haiku via bedrock
  };

  const rate = rates[provider] || { input: 0, output: 0 };
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}
