/**
 * Unified LLM caller — supports Anthropic, OpenAI, Gemini, Kimi, Ollama
 * All providers are called via HTTP to avoid SDK dependencies
 */

export type LLMProvider = "anthropic" | "openai" | "gemini" | "kimi" | "ollama";

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
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${llmKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: userMessage }] }],
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Gemini API error");
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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

    default:
      throw new Error(`Unknown LLM provider: ${llmProvider}`);
  }
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
