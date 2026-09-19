-- ════════════════════════════════════════════════════════════════════════════
-- Phase 1B — Deterministic Automation Correlation
-- Migration: automation_context_tokens_v1
-- Run AFTER migration_phase1_automation_repair.sql
-- All statements are idempotent.
-- ════════════════════════════════════════════════════════════════════════════

-- ── automation_context_tokens: opaque server-side correlation store ───────────
-- Each token maps a client-visible opaque ID to the EXACT automation execution context.
-- The quick_reply payload sent to Meta is: "AUTO:<token_id>"
-- When Meta sends the postback, we look up the token to find the exact context.
-- Tokens are:
--   - unguessable (UUID v4)
--   - scoped to account + platform + tenant
--   - single-use (consumed on first successful use)
--   - expiring (48 hours default)
--   - never contain PII or access tokens
CREATE TABLE IF NOT EXISTS public.automation_context_tokens (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,  -- opaque token
  -- Tenant + platform scope (reject if mismatch)
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES public.connected_accounts(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  -- Automation context
  rule_id          UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  comment_id       TEXT NOT NULL,           -- original comment that triggered the flow
  commentor_id     TEXT NOT NULL,           -- comment.from.id (may differ from IGSID)
  -- IGSID captured when user taps the button (filled in after first interaction)
  igsid            TEXT,
  -- Lifecycle
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'interacted', 'access_sent', 'expired', 'rejected')),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  interacted_at    TIMESTAMPTZ,            -- when user tapped CTA
  consumed_at      TIMESTAMPTZ,            -- when access was delivered
  -- Recheck tracking
  recheck_attempts INTEGER NOT NULL DEFAULT 0,
  max_recheck_attempts INTEGER NOT NULL DEFAULT 3,
  -- Observability
  correlation_id   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Secure index for token lookup by ID
CREATE INDEX IF NOT EXISTS idx_act_id_status
  ON public.automation_context_tokens(id, status);

-- Index for looking up pending tokens by account
CREATE INDEX IF NOT EXISTS idx_act_account_created
  ON public.automation_context_tokens(account_id, created_at DESC);

-- Expiry cleanup index
CREATE INDEX IF NOT EXISTS idx_act_expires
  ON public.automation_context_tokens(expires_at) WHERE status = 'pending';

-- RLS: only service role can access
ALTER TABLE public.automation_context_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.automation_context_tokens
  USING (false) WITH CHECK (false);

-- ════════════════════════════════════════════════════════════════════════════
-- Done. Copy this file to database/migrations/ and run in Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════
