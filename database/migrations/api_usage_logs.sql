-- Migration: api_usage_logs
-- Tracks token usage and estimated cost per user per AI call

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,        -- 'gemini' | 'anthropic' | 'openai' | 'bedrock'
  endpoint TEXT NOT NULL,        -- feature: 'audit' | 'competitors' | 'hashtags' | 'ideas' | 'insights'
  key_source TEXT NOT NULL,      -- 'user_own' | 'platform'
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  tokens_total INT DEFAULT 0,
  cost_usd DECIMAL(12, 8) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own logs; backend (service role) inserts
CREATE POLICY "api_usage_logs_read_own" ON api_usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_created ON api_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_provider ON api_usage_logs(user_id, provider);
