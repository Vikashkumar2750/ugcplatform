-- ============================================================
-- Content Engineer — FULL CONSOLIDATED MIGRATION
-- Idempotent: safe to run multiple times, no errors on re-run
-- Run this ONCE in Supabase SQL Editor → New Query → Run
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ══════════════════════════════════════════════════════════════════
-- TABLE: leads
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.leads (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name            TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  whatsapp             TEXT NOT NULL,
  platform             TEXT NOT NULL,
  niche                TEXT NOT NULL,
  source               TEXT,
  payment_status       TEXT DEFAULT 'pending'
                       CHECK (payment_status IN ('pending','paid','failed')),
  razorpay_order_id    TEXT,
  razorpay_payment_id  TEXT,
  payment_amount       INTEGER DEFAULT 900,
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_payment_status ON public.leads(payment_status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages leads" ON public.leads;
CREATE POLICY "Service role manages leads" ON public.leads FOR ALL USING (false);

-- ══════════════════════════════════════════════════════════════════
-- TABLE: analyses
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.analyses (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id           UUID REFERENCES public.leads(id),
  profile_url       TEXT NOT NULL,
  platform          TEXT NOT NULL,
  handle            TEXT,
  niche             TEXT,
  language          TEXT DEFAULT 'hi',
  competitor_mode   TEXT DEFAULT 'discover'
                    CHECK (competitor_mode IN ('known','discover','skip')),
  competitor_urls   TEXT[],
  profession_text   TEXT,
  selected_phases   TEXT[],
  status            TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','running','complete','failed')),
  error_message     TEXT,
  result            JSONB,
  created_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analyses_user_id   ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON public.analyses(created_at DESC);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own analyses"   ON public.analyses;
DROP POLICY IF EXISTS "Users insert own analyses" ON public.analyses;
DROP POLICY IF EXISTS "Users update own analyses" ON public.analyses;
CREATE POLICY "Users view own analyses"   ON public.analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own analyses" ON public.analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own analyses" ON public.analyses FOR UPDATE USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════
-- TABLE: generated_scripts
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.generated_scripts (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  analysis_id  UUID REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  day          TEXT NOT NULL,
  format       TEXT NOT NULL,
  topic        TEXT NOT NULL,
  hook         TEXT NOT NULL,
  trigger_type TEXT,
  script       TEXT NOT NULL,
  caption      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripts_analysis_id ON public.generated_scripts(analysis_id);
CREATE INDEX IF NOT EXISTS idx_scripts_user_id     ON public.generated_scripts(user_id);

ALTER TABLE public.generated_scripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own scripts"   ON public.generated_scripts;
DROP POLICY IF EXISTS "Users insert own scripts" ON public.generated_scripts;
CREATE POLICY "Users view own scripts"   ON public.generated_scripts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scripts" ON public.generated_scripts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════
-- TABLE: admin_users
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_users (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages admins" ON public.admin_users;
CREATE POLICY "Service role manages admins" ON public.admin_users FOR ALL USING (false);

-- ══════════════════════════════════════════════════════════════════
-- TABLE: profiles  (extends auth.users, auto-created on signup)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id                           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                        TEXT,
  full_name                    TEXT,
  avatar_url                   TEXT,
  platform_api_allowed         BOOLEAN DEFAULT true,
  platform_api_disabled_reason TEXT,
  subscription_status          TEXT DEFAULT 'inactive',
  subscription_plan            TEXT,
  subscription_activated_at    TIMESTAMPTZ,
  payment_utr                  TEXT,
  payment_txn_id               TEXT,
  created_at                   TIMESTAMPTZ DEFAULT now(),
  updated_at                   TIMESTAMPTZ DEFAULT now()
);

-- Add any missing columns safely (for existing tables)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS platform_api_allowed         BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS platform_api_disabled_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status          TEXT DEFAULT 'inactive';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan            TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_activated_at   TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_utr                 TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_txn_id              TEXT;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own_profile"   ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "service_role_all"          ON public.profiles;
CREATE POLICY "users_read_own_profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own_profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ══════════════════════════════════════════════════════════════════
-- TABLE: payments  (UPI manual verification)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.payments (
  id               TEXT PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email       TEXT,
  amount_inr       NUMERIC(10,2) NOT NULL,
  method           TEXT DEFAULT 'upi',
  status           TEXT DEFAULT 'pending'
                   CHECK (status IN ('pending','pending_verification','verified','failed','refunded')),
  utr_number       TEXT,
  utr_submitted_at TIMESTAMPTZ,
  verified_at      TIMESTAMPTZ,
  verified_by      UUID,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx  ON public.payments(status);
CREATE INDEX IF NOT EXISTS payments_created_idx ON public.payments(created_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_payments"    ON public.payments;
DROP POLICY IF EXISTS "users_insert_payment"  ON public.payments;
CREATE POLICY "users_own_payments"   ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_payment" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════
-- TABLE: user_api_keys  (AES-256-GCM encrypted keys per provider)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider     TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  label        TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_provider ON public.user_api_keys(user_id, provider);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_api_keys_own" ON public.user_api_keys;
CREATE POLICY "user_api_keys_own" ON public.user_api_keys
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════
-- TABLE: api_usage_logs  (token + cost tracking)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider      TEXT NOT NULL,
  endpoint      TEXT NOT NULL,
  key_source    TEXT NOT NULL,
  tokens_input  INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  tokens_total  INT DEFAULT 0,
  cost_usd      DECIMAL(12,8) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_created  ON public.api_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_provider ON public.api_usage_logs(user_id, provider);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_usage_logs_read_own" ON public.api_usage_logs;
CREATE POLICY "api_usage_logs_read_own" ON public.api_usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════
-- Helper: updated_at trigger
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at    ON public.leads;
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ══════════════════════════════════════════════════════════════════
-- VIEW: admin_dashboard_stats
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.admin_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM public.leads)                                      AS total_leads,
  (SELECT COUNT(*) FROM public.leads WHERE payment_status = 'paid')        AS paid_users,
  (SELECT COUNT(*) FROM public.payments WHERE status = 'verified')         AS verified_payments,
  (SELECT COUNT(*) FROM public.analyses)                                   AS total_analyses,
  (SELECT COUNT(*) FROM public.analyses WHERE status = 'complete')         AS complete_analyses,
  (SELECT COUNT(*) FROM public.generated_scripts)                          AS total_scripts,
  (SELECT COALESCE(SUM(amount_inr),0) FROM public.payments WHERE status='verified') AS total_revenue_inr;

-- ══════════════════════════════════════════════════════════════════
-- Backfill: create profiles for any existing auth.users
-- ══════════════════════════════════════════════════════════════════
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', email)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ── DONE ──────────────────────────────────────────────────────────
-- All tables, policies, triggers created. Safe to re-run anytime.
