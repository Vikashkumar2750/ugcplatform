-- ============================================================
-- Migration: Phase 1 Critical Bug Fixes
-- Run AFTER all previous migrations
-- ============================================================

-- ── 1. Atomic trigger count increment (BUG-06 fix) ──
-- Prevents race condition where two concurrent webhooks both read
-- trigger_count=5 and both write 6, losing one increment.
CREATE OR REPLACE FUNCTION public.increment_trigger_count(rule_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.automation_rules
  SET trigger_count = COALESCE(trigger_count, 0) + 1,
      last_triggered = NOW(),
      updated_at = NOW()
  WHERE id = rule_id;
END;
$$;

-- ── 2. Idempotency key on message_queue (BUG-14 fix) ──
-- Prevents duplicate messages when Meta retries the same webhook event.
ALTER TABLE public.message_queue 
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Create unique index (partial — only for non-null keys)
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_queue_idempotency 
  ON public.message_queue(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- ── 3. dm_conversations unique constraint (BUG-07/BUG-09 fix) ──
-- Without this, concurrent webhooks create duplicate conversation rows
-- and the opt-out upsert silently fails.
-- First, deduplicate existing rows (keep the one with highest message_count)
DELETE FROM public.dm_conversations a
USING public.dm_conversations b
WHERE a.account_id = b.account_id
  AND a.sender_id = b.sender_id
  AND a.id <> b.id
  AND a.message_count < b.message_count;

-- Handle any remaining exact duplicates (same message_count)
DELETE FROM public.dm_conversations a
USING public.dm_conversations b
WHERE a.account_id = b.account_id
  AND a.sender_id = b.sender_id
  AND a.id < b.id;  -- keep the one with the "larger" UUID (arbitrary but deterministic)

ALTER TABLE public.dm_conversations 
  ADD CONSTRAINT dm_conversations_account_sender_unique 
  UNIQUE (account_id, sender_id);

-- ── 4. automation_conversations state machine (new table) ──
-- Tracks the state of each user's automation journey:
-- private_reply_sent → user_replied → follower_checked → link_sent → completed
CREATE TABLE IF NOT EXISTS public.automation_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id UUID REFERENCES public.connected_accounts(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  user_ig_id TEXT NOT NULL,        -- Instagram User ID from comment
  user_igsid TEXT,                 -- Instagram Scoped ID from messaging (available after user replies)
  comment_id TEXT NOT NULL,        -- Original triggering comment
  state TEXT NOT NULL DEFAULT 'private_reply_sent'
    CHECK (state IN ('private_reply_sent', 'user_replied', 'follower_checked', 'link_sent', 'completed', 'expired')),
  is_following BOOLEAN,
  private_reply_sent_at TIMESTAMPTZ,
  user_replied_at TIMESTAMPTZ,
  link_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one conversation per (account, rule, user) combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_conv_unique 
  ON public.automation_conversations(account_id, rule_id, user_ig_id);

-- Index for quick lookup by user
CREATE INDEX IF NOT EXISTS idx_automation_conv_user 
  ON public.automation_conversations(user_ig_id);

-- Index for state queries
CREATE INDEX IF NOT EXISTS idx_automation_conv_state 
  ON public.automation_conversations(state) 
  WHERE state NOT IN ('completed', 'expired');

-- RLS
ALTER TABLE public.automation_conversations ENABLE ROW LEVEL SECURITY;

-- Service role only (webhook handler uses service role)
CREATE POLICY "Service manages automation_conversations" 
  ON public.automation_conversations
  FOR ALL USING (false);

-- Updated_at trigger
CREATE TRIGGER automation_conversations_updated_at
  BEFORE UPDATE ON public.automation_conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 5. Add last_user_interaction_at to dm_conversations ──
-- Required for 24h messaging window compliance tracking
ALTER TABLE public.dm_conversations 
  ADD COLUMN IF NOT EXISTS last_user_interaction_at TIMESTAMPTZ;
