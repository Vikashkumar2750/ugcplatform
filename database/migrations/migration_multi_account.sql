-- ============================================================
-- Migration: Multi-Account Support + Subscription Gating
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add 'linkedin' to the platform CHECK constraint
ALTER TABLE public.connected_accounts 
  DROP CONSTRAINT IF EXISTS connected_accounts_platform_check;
ALTER TABLE public.connected_accounts 
  ADD CONSTRAINT connected_accounts_platform_check 
  CHECK (platform IN ('instagram', 'facebook', 'youtube', 'linkedin'));

-- 2. Add subscription/multi-account fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS max_accounts_per_platform INTEGER DEFAULT 1;
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- 3. Create subscription_plans reference table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                          TEXT PRIMARY KEY,
  name                        TEXT NOT NULL,
  price_inr                   NUMERIC(10,2) NOT NULL,
  duration_days               INTEGER NOT NULL,
  max_accounts_per_platform   INTEGER DEFAULT 5,
  features                    JSONB DEFAULT '[]',
  is_active                   BOOLEAN DEFAULT true,
  created_at                  TIMESTAMPTZ DEFAULT now()
);

-- Seed plans
INSERT INTO public.subscription_plans (id, name, price_inr, duration_days, max_accounts_per_platform, features) VALUES
  ('pro_monthly',  'Pro Monthly',  59,  30,  5, '["5 accounts per platform","Priority support","All automations"]'),
  ('pro_6month',   'Pro 6-Month',  299, 180, 5, '["5 accounts per platform","Priority support","All automations","Save 15%"]'),
  ('pro_yearly',   'Pro Yearly',   599, 365, 5, '["5 accounts per platform","Priority support","All automations","Save 50%"]')
ON CONFLICT (id) DO NOTHING;

-- RLS for subscription_plans (public read, admin write)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_plans" ON public.subscription_plans;
CREATE POLICY "anyone_can_read_plans" ON public.subscription_plans
  FOR SELECT USING (true);

-- 4. Grant existing lifetime users (subscription_status = 'active') pro access
-- Run this AFTER migration to auto-upgrade lifetime users:
-- UPDATE public.profiles 
--   SET subscription_tier = 'pro', max_accounts_per_platform = 5 
--   WHERE subscription_status = 'active';

COMMENT ON COLUMN public.profiles.max_accounts_per_platform IS 'Max accounts per platform. 1=free, 5=pro. Admin can override.';
COMMENT ON COLUMN public.profiles.subscription_tier IS 'free | pro | admin_granted. Controls feature gating.';
