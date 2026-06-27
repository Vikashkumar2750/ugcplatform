-- ============================================================
-- Migration: Compliance Layer v1
-- Adds: message_queue, compliance_logs, rate_limit_state
-- Modifies: dm_conversations, automation_rules
-- Run in Supabase SQL Editor → New Query → Run
-- Idempotent: safe to run multiple times
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- TABLE: message_queue
-- Central outbound message queue. Every automated message
-- passes through compliance + rate limiter before dequeuing.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.message_queue (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id         UUID REFERENCES public.connected_accounts(id) ON DELETE CASCADE,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id       TEXT NOT NULL,
  message_payload    JSONB NOT NULL,
  -- { text: string, attachment?: {...}, quick_replies?: [...], link?: string }
  message_type       TEXT DEFAULT 'dm'
                     CHECK (message_type IN ('dm', 'comment_reply', 'broadcast')),
  automation_rule_id UUID REFERENCES public.automation_rules(id) ON DELETE SET NULL,

  -- Compliance gate
  compliance_status  TEXT DEFAULT 'pending'
                     CHECK (compliance_status IN ('pending', 'approved', 'blocked')),
  compliance_reason  TEXT,           -- reason code if blocked

  -- Rate limit gate
  rate_limit_status  TEXT DEFAULT 'pending'
                     CHECK (rate_limit_status IN ('pending', 'approved', 'delayed', 'blocked')),

  -- Queue state
  status             TEXT DEFAULT 'queued'
                     CHECK (status IN ('queued', 'compliance_check', 'rate_check', 'ready',
                                       'processing', 'sent', 'failed', 'blocked')),
  priority           INTEGER DEFAULT 5,  -- 1=highest, 10=lowest
  scheduled_send_at  TIMESTAMPTZ DEFAULT NOW(),
  processing_at      TIMESTAMPTZ,       -- when a worker picked it up
  sent_at            TIMESTAMPTZ,
  error              TEXT,
  retry_count        INTEGER DEFAULT 0,
  max_retries        INTEGER DEFAULT 3,
  meta_message_id    TEXT,              -- returned by Meta on success

  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for queue polling (hot path)
CREATE INDEX IF NOT EXISTS idx_mq_status_priority
  ON public.message_queue(status, priority, scheduled_send_at)
  WHERE status IN ('queued', 'ready');

CREATE INDEX IF NOT EXISTS idx_mq_account_created
  ON public.message_queue(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mq_processing_stale
  ON public.message_queue(processing_at)
  WHERE status = 'processing';

-- ══════════════════════════════════════════════════════════════
-- TABLE: compliance_logs
-- Immutable audit trail of every compliance decision.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.compliance_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id      UUID REFERENCES public.connected_accounts(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_id    TEXT,
  direction       TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  decision        TEXT NOT NULL CHECK (decision IN ('allowed', 'blocked')),
  reason_code     TEXT,
  -- Reason codes: 'outside_messaging_window', 'rate_exceeded', 'opted_out',
  -- 'blocked_content', 'invalid_message_tag', 'account_inactive', 'manual_block'
  reason_detail   TEXT,
  message_preview TEXT,               -- first 50 chars for audit (no PII in full message)
  queue_id        UUID,               -- reference to message_queue.id
  rule_id         UUID,               -- reference to automation_rules.id
  meta_data       JSONB DEFAULT '{}', -- extra context (window_expires_at, etc.)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cl_account_created
  ON public.compliance_logs(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cl_decision
  ON public.compliance_logs(decision, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cl_reason_code
  ON public.compliance_logs(reason_code)
  WHERE decision = 'blocked';

-- ══════════════════════════════════════════════════════════════
-- TABLE: rate_limit_state
-- Per-account sliding window rate limit counters.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.rate_limit_state (
  account_id       UUID PRIMARY KEY REFERENCES public.connected_accounts(id) ON DELETE CASCADE,
  hourly_count     INTEGER DEFAULT 0,
  hourly_window_start TIMESTAMPTZ DEFAULT NOW(),
  last_send_at     TIMESTAMPTZ,
  daily_count      INTEGER DEFAULT 0,
  daily_window_start TIMESTAMPTZ DEFAULT NOW(),
  config_override  JSONB DEFAULT '{}',
  -- { hourly_limit: 120, per_user_spacing_ms: 5000, aggressive: false }
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- TABLE: human_review_queue
-- Low-confidence AI replies and escalated messages.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.human_review_queue (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id      UUID REFERENCES public.connected_accounts(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.dm_conversations(id) ON DELETE SET NULL,
  recipient_id    TEXT NOT NULL,
  ai_draft_text   TEXT NOT NULL,
  ai_confidence   NUMERIC(5,2),       -- 0.00 to 100.00
  ai_provider     TEXT,
  ai_model        TEXT,
  escalation_reason TEXT,
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'edited', 'discarded', 'sent')),
  agent_id        UUID REFERENCES auth.users(id),  -- who reviewed it
  agent_edit      TEXT,                -- edited version (if any)
  reviewed_at     TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hrq_status
  ON public.human_review_queue(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_hrq_account
  ON public.human_review_queue(account_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- ALTER: dm_conversations — add 24h window tracking
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.dm_conversations
  ADD COLUMN IF NOT EXISTS last_user_interaction_at TIMESTAMPTZ;

-- Backfill: set last_user_interaction_at = last_message_at for existing rows
UPDATE public.dm_conversations
  SET last_user_interaction_at = last_message_at
  WHERE last_user_interaction_at IS NULL
    AND last_message_at IS NOT NULL;

-- Index for 24h window lookups
CREATE INDEX IF NOT EXISTS idx_dm_conv_interaction
  ON public.dm_conversations(account_id, sender_id, last_user_interaction_at);

-- ══════════════════════════════════════════════════════════════
-- ALTER: automation_rules — add draft/publish workflow
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS publish_status TEXT DEFAULT 'published'
    CHECK (publish_status IN ('draft', 'published', 'paused'));

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS published_trigger_config JSONB;

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS published_action_config JSONB;

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS draft_trigger_config JSONB;

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS draft_action_config JSONB;

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS previous_trigger_config JSONB;

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS previous_action_config JSONB;

-- Backfill: copy existing config to published_* for active rules
UPDATE public.automation_rules
  SET published_trigger_config = trigger_config,
      published_action_config = action_config,
      published_at = NOW()
  WHERE published_trigger_config IS NULL
    AND is_active = true;

-- ══════════════════════════════════════════════════════════════
-- RLS Policies
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_review_queue ENABLE ROW LEVEL SECURITY;

-- message_queue: users see own, service role manages
DROP POLICY IF EXISTS "Users view own queue" ON public.message_queue;
CREATE POLICY "Users view own queue" ON public.message_queue
  FOR SELECT USING (auth.uid() = user_id);

-- compliance_logs: users see own
DROP POLICY IF EXISTS "Users view own compliance logs" ON public.compliance_logs;
CREATE POLICY "Users view own compliance logs" ON public.compliance_logs
  FOR SELECT USING (auth.uid() = user_id);

-- rate_limit_state: service role only
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.rate_limit_state;
CREATE POLICY "Service role manages rate limits" ON public.rate_limit_state
  FOR ALL USING (false);

-- human_review_queue: users see own
DROP POLICY IF EXISTS "Users manage own review queue" ON public.human_review_queue;
CREATE POLICY "Users manage own review queue" ON public.human_review_queue
  FOR ALL USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════
-- Triggers: updated_at
-- ══════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS message_queue_updated_at ON public.message_queue;
CREATE TRIGGER message_queue_updated_at
  BEFORE UPDATE ON public.message_queue
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS rate_limit_state_updated_at ON public.rate_limit_state;
CREATE TRIGGER rate_limit_state_updated_at
  BEFORE UPDATE ON public.rate_limit_state
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ══════════════════════════════════════════════════════════════
-- DONE — Compliance Layer v1 schema ready
-- ══════════════════════════════════════════════════════════════
