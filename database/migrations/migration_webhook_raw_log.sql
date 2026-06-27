-- Create webhook_raw_log table for debugging
-- This logs EVERY incoming webhook payload before any processing
CREATE TABLE IF NOT EXISTS webhook_raw_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  object_type TEXT NOT NULL DEFAULT 'unknown',
  raw_body JSONB NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent logs
CREATE INDEX IF NOT EXISTS idx_webhook_raw_log_received 
  ON webhook_raw_log (received_at DESC);

-- Auto-cleanup: keep only last 7 days of logs
-- (Run this periodically or set up a cron)
-- DELETE FROM webhook_raw_log WHERE received_at < NOW() - INTERVAL '7 days';
