-- Migration: payments table for UPI manual verification
-- Run this in Supabase SQL Editor AFTER schema.sql

-- ── Step 1: Create profiles table (extends auth.users) ─────────────────────────
-- Supabase does not auto-create this — we create it here
CREATE TABLE IF NOT EXISTS public.profiles (
  id                          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                       TEXT,
  full_name                   TEXT,
  avatar_url                  TEXT,
  -- Platform API access (admin can disable per user)
  platform_api_allowed        BOOLEAN DEFAULT true,
  platform_api_disabled_reason TEXT,
  -- Subscription
  subscription_status         TEXT DEFAULT 'inactive',
  subscription_plan           TEXT,
  subscription_activated_at   TIMESTAMPTZ,
  payment_utr                 TEXT,
  payment_txn_id              TEXT,
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now()
);

-- RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_read_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "users_update_own_profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile row when user signs up
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

-- ── Step 2: payments table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                TEXT PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email        TEXT,
  amount_inr        NUMERIC(10,2) NOT NULL,
  method            TEXT DEFAULT 'upi',
  status            TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','pending_verification','verified','failed','refunded')),
  utr_number        TEXT,
  utr_submitted_at  TIMESTAMPTZ,
  verified_at       TIMESTAMPTZ,
  verified_by       UUID,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx  ON public.payments(status);
CREATE INDEX IF NOT EXISTS payments_created_idx ON public.payments(created_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_payment" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.payments IS 'UPI payment records. Verify UTR manually then set status=verified.';
COMMENT ON TABLE public.profiles IS 'User profiles extending auth.users. Auto-created on signup.';
