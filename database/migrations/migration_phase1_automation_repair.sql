-- ════════════════════════════════════════════════════════════════════════════
-- Phase 1 — Meta Automation Production Repair
-- Migration: automation_repair_v1
-- Run this ONCE against your Supabase project.
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS guards).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. processed_comments: add platform, igsid, follower tracking ────────────
-- platform: which platform the comment came from (instagram | facebook)
ALTER TABLE public.processed_comments
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.connected_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS igsid TEXT,                    -- messaging IGSID captured after user replies
  ADD COLUMN IF NOT EXISTS private_reply_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS private_reply_message_id TEXT,
  ADD COLUMN IF NOT EXISTS follower_check_result TEXT,    -- 'following' | 'not_following' | 'failed' | 'skipped'
  ADD COLUMN IF NOT EXISTS follower_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follower_check_error TEXT,     -- raw error from Meta API if failed
  ADD COLUMN IF NOT EXISTS recheck_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS access_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT;           -- tracing across all steps

-- Index for IGSID lookup (messaging webhook → find pending comment)
CREATE INDEX IF NOT EXISTS idx_processed_comments_igsid
  ON public.processed_comments(igsid) WHERE igsid IS NOT NULL;

-- Index for commentor_id lookup (find pending flow for a sender)
CREATE INDEX IF NOT EXISTS idx_processed_comments_commentor_id
  ON public.processed_comments(commentor_id);

-- Index for account + commentor lookup (tenant-scoped)
CREATE INDEX IF NOT EXISTS idx_processed_comments_account_commentor
  ON public.processed_comments(account_id, commentor_id);

-- ── 2. dm_conversations: add last_user_interaction_at if missing ─────────────
ALTER TABLE public.dm_conversations
  ADD COLUMN IF NOT EXISTS last_user_interaction_at TIMESTAMPTZ;

-- ── 3. automation_rules: fix type constraint to include comment_automation ────
-- The existing check constraint may not include 'comment_automation'.
-- Drop the old constraint and recreate it with the full set of valid types.
ALTER TABLE public.automation_rules
  DROP CONSTRAINT IF EXISTS automation_rules_type_check;

ALTER TABLE public.automation_rules
  ADD CONSTRAINT automation_rules_type_check
  CHECK (type IN (
    'dm_keyword',
    'dm_new_follower',
    'comment_reply',
    'comment_to_dm',
    'story_reply',
    'comment_automation'   -- ← unified comment automation type (was missing)
  ));

-- ── 4. automation_rules: add reply_enabled / dm_enabled / hide_enabled flags ─
-- These allow fine-grained control per rule without relying on JSONB parsing.
ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS reply_enabled BOOLEAN,   -- NULL = infer from action_config
  ADD COLUMN IF NOT EXISTS dm_enabled    BOOLEAN,   -- NULL = infer from action_config
  ADD COLUMN IF NOT EXISTS hide_enabled  BOOLEAN;   -- NULL = infer from action_config

-- ── 5. webhook_events: add correlation_id for tracing ────────────────────────
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.connected_accounts(id) ON DELETE SET NULL;

-- ── 6. message_queue: add platform field for cross-platform routing ───────────
ALTER TABLE public.message_queue
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT;

-- ── 7. Increment trigger count RPC (safe upsert) ─────────────────────────────
-- Ensures trigger_count++ is atomic and race-condition safe.
CREATE OR REPLACE FUNCTION public.increment_trigger_count(rule_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.automation_rules
  SET trigger_count = COALESCE(trigger_count, 0) + 1,
      last_triggered = NOW()
  WHERE id = rule_id;
END;
$$;

-- ── 8. rate_limit_state ───────────────────────────────────────────────────────
-- Already created by migration_compliance_v1.sql. No changes needed here.
-- Do NOT attempt to ALTER it — the existing schema is managed by the compliance migration.


-- ── 9. automation_executions: fine-grained execution audit trail ─────────────
-- Each step of the automation flow is logged here with its outcome.
CREATE TABLE IF NOT EXISTS public.automation_executions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  correlation_id   TEXT NOT NULL,
  account_id       UUID REFERENCES public.connected_accounts(id) ON DELETE SET NULL,
  rule_id          UUID REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  platform         TEXT NOT NULL,
  step             TEXT NOT NULL,
  -- Steps: WEBHOOK_RECEIVED | EVENT_NORMALIZED | COMMENT_MATCHED | PUBLIC_REPLY_QUEUED |
  --        PRIVATE_REPLY_SENT | USER_INTERACTION_RECEIVED | IGSID_CAPTURED |
  --        FOLLOWER_CHECK_STARTED | FOLLOWER_CHECK_SUCCESS | FOLLOWER_CHECK_FAILED |
  --        FOLLOW_REQUIRED | FOLLOW_CONFIRMATION_RECEIVED | FOLLOWER_RECHECKED |
  --        ACCESS_SENT | AUTOMATION_COMPLETED | AUTOMATION_FAILED |
  --        FOLLOW_VERIFICATION_LIMIT_REACHED
  status           TEXT NOT NULL,                -- 'ok' | 'error' | 'skipped'
  detail           JSONB,                        -- step-specific data (no PII values)
  error_message    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_correlation
  ON public.automation_executions(correlation_id);

CREATE INDEX IF NOT EXISTS idx_automation_executions_account_created
  ON public.automation_executions(account_id, created_at DESC);

ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.automation_executions
  USING (false) WITH CHECK (false);

-- ════════════════════════════════════════════════════════════════════════════
-- Done.
-- ════════════════════════════════════════════════════════════════════════════
