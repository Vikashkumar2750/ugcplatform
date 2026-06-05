import { Router, Response } from "express";
import { supabase } from "../lib/supabase";
import { encrypt, decrypt } from "../services/crypto";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/keys — list user's saved providers (never returns actual key)
router.get("/", async (req, res: Response) => {
  const { userId } = req as AuthenticatedRequest;

  const { data, error } = await supabase
    .from("user_api_keys")
    .select("id, provider, label, is_active, created_at, last_used_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ keys: data });
});

// POST /api/keys — add or replace a key for a provider
router.post("/", async (req, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { provider, key, label } = req.body as {
    provider: string;
    key: string;
    label?: string;
  };

  if (!provider || !key) {
    return res.status(400).json({ error: "provider and key are required" });
  }

  const ALLOWED_PROVIDERS = [
    "gemini", "anthropic", "openai", "bedrock", "apify", "rapidapi",
  ];
  if (!ALLOWED_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  const encryptedKey = encrypt(key);

  const { error } = await supabase.from("user_api_keys").upsert(
    {
      user_id: userId,
      provider,
      encrypted_key: encryptedKey,
      label: label || provider,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true, provider });
});

// DELETE /api/keys/:provider — remove a provider's key
router.delete("/:provider", async (req, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { provider } = req.params;

  const { error } = await supabase
    .from("user_api_keys")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

// POST /api/keys/:provider/test — validate a key works (minimal API call)
router.post("/:provider/test", async (req, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { provider } = req.params;

  // Fetch the user's stored key
  const { data: keyRow, error: dbError } = await supabase
    .from("user_api_keys")
    .select("encrypted_key")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  if (dbError || !keyRow) {
    return res.status(404).json({ error: "No key found for this provider" });
  }

  const apiKey = decrypt(keyRow.encrypted_key);

  try {
    const result = await testProviderKey(provider, apiKey);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ─── Internal helpers ──────────────────────────────────────────────────────────

async function testProviderKey(
  provider: string,
  key: string
): Promise<{ model?: string; message?: string }> {
  switch (provider) {
    case "gemini": {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Reply with just: ok" }] }],
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      return { model: "gemini-2.0-flash-lite", message: "Key is valid" };
    }

    case "anthropic": {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 5,
          messages: [{ role: "user", content: "Reply: ok" }],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      return { model: "claude-3-haiku", message: "Key is valid" };
    }

    case "openai": {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "Reply: ok" }],
          max_tokens: 5,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      return { model: "gpt-3.5-turbo", message: "Key is valid" };
    }

    case "apify": {
      const res = await fetch(
        `https://api.apify.com/v2/users/me?token=${key}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { message: `Valid — user: ${data.data?.username || "unknown"}` };
    }

    case "rapidapi": {
      // Test with a lightweight endpoint
      const res = await fetch(
        "https://instagram120.p.rapidapi.com/api/instagram/user?username=instagram",
        {
          headers: {
            "x-rapidapi-host": "instagram120.p.rapidapi.com",
            "x-rapidapi-key": key,
          },
        }
      );
      // 200 or 404 both mean key is valid; 403 means invalid key
      if (res.status === 403) throw new Error("Invalid RapidAPI key");
      return { message: "RapidAPI key is valid" };
    }

    case "bedrock": {
      // Bearer token — just check format (AWS Bedrock tokens are base64)
      if (!key || key.length < 20) throw new Error("Invalid Bedrock token format");
      return { message: "Bedrock bearer token saved (format OK)" };
    }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export default router;
