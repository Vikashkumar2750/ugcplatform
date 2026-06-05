-- Migration: processed_comments table for atomic dedup of comment automation
-- Prevents infinite auto-reply loops when Meta sends webhook multiple times

CREATE TABLE IF NOT EXISTS processed_comments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id  text NOT NULL,
  rule_id     uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  commentor_id text,
  media_id    text,
  processed_at timestamptz NOT NULL DEFAULT now(),

  -- UNIQUE constraint is the core dedup mechanism
  -- If same (comment_id + rule_id) is inserted twice, Postgres throws 23505
  CONSTRAINT processed_comments_comment_rule_unique UNIQUE (comment_id, rule_id)
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_processed_comments_processed_at
  ON processed_comments (processed_at);

-- Auto-cleanup: delete records older than 30 days (comments can't be replied to after that)
-- (Run via a weekly cron or manually)
-- DELETE FROM processed_comments WHERE processed_at < now() - interval '30 days';

-- RLS: service role only (no user-level access needed)
ALTER TABLE processed_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON processed_comments
  USING (false)
  WITH CHECK (false);
