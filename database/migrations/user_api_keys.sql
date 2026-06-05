-- Migration: user_api_keys
-- Stores encrypted API keys per user per provider

CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,        -- 'gemini' | 'anthropic' | 'openai' | 'bedrock' | 'apify' | 'rapidapi'
  encrypted_key TEXT NOT NULL,   -- AES-256-GCM encrypted value
  label TEXT,                    -- user-friendly display name
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, provider)
);

-- Users can only read/write their own keys; never see the encrypted value from client
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_api_keys_own" ON user_api_keys
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_provider ON user_api_keys(user_id, provider);
