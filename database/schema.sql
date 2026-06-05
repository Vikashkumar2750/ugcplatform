-- ============================================================
-- UGC Content Intelligence Platform — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: leads
-- Stores user registrations before payment
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  whatsapp      TEXT NOT NULL,
  platform      TEXT NOT NULL,
  niche         TEXT NOT NULL,
  source        TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  razorpay_order_id  TEXT,
  razorpay_payment_id TEXT,
  payment_amount INTEGER DEFAULT 900, -- in paise (₹9 = 900 paise)
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: analyses
-- Stores each analysis run
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analyses (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id       UUID REFERENCES public.leads(id),
  profile_url   TEXT NOT NULL,
  platform      TEXT NOT NULL,
  handle        TEXT,
  niche         TEXT,
  language      TEXT DEFAULT 'hi',
  competitor_mode TEXT DEFAULT 'discover' CHECK (competitor_mode IN ('known', 'discover', 'skip')),
  competitor_urls TEXT[], -- array of competitor URLs
  profession_text TEXT, -- for niche discovery
  selected_phases TEXT[], -- which phases to run
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  error_message TEXT,
  result        JSONB, -- stores the full AnalysisResult object
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- ============================================================
-- Table: generated_scripts
-- Normalized script storage for easy export
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generated_scripts (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  analysis_id   UUID REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,
  format        TEXT NOT NULL,
  topic         TEXT NOT NULL,
  hook          TEXT NOT NULL,
  trigger_type  TEXT,
  script        TEXT NOT NULL,
  caption       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: admin_users
-- Tracks which user IDs are admins
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email         TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_payment_status ON public.leads(payment_status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON public.analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scripts_analysis_id ON public.generated_scripts(analysis_id);
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON public.generated_scripts(user_id);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Leads: only service role can insert/read (handled by API routes)
CREATE POLICY "Service role manages leads" ON public.leads
  FOR ALL USING (false); -- Block direct client access

-- Analyses: users can only see their own
CREATE POLICY "Users view own analyses" ON public.analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own analyses" ON public.analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own analyses" ON public.analyses
  FOR UPDATE USING (auth.uid() = user_id);

-- Scripts: users can only see their own
CREATE POLICY "Users view own scripts" ON public.generated_scripts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own scripts" ON public.generated_scripts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin: only service role can manage
CREATE POLICY "Service role manages admins" ON public.admin_users
  FOR ALL USING (false);

-- ============================================================
-- Helper: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- View: admin_dashboard_stats (for the admin UI)
-- ============================================================
CREATE OR REPLACE VIEW public.admin_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM public.leads) AS total_leads,
  (SELECT COUNT(*) FROM public.leads WHERE payment_status = 'paid') AS paid_users,
  (SELECT COUNT(*) FROM public.analyses) AS total_analyses,
  (SELECT COUNT(*) FROM public.analyses WHERE status = 'complete') AS complete_analyses,
  (SELECT COUNT(*) FROM public.generated_scripts) AS total_scripts,
  (SELECT SUM(payment_amount) FROM public.leads WHERE payment_status = 'paid') AS total_revenue_paise;
