-- Migration: payments table for UPI manual verification
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS payments (
  id              TEXT PRIMARY KEY,           -- txnId (CE-timestamp-random)
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_email      TEXT,
  amount_inr      NUMERIC(10,2) NOT NULL,
  method          TEXT DEFAULT 'upi',
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending','pending_verification','verified','failed','refunded')),
  utr_number      TEXT,
  utr_submitted_at TIMESTAMPTZ,
  verified_at     TIMESTAMPTZ,
  verified_by     UUID,                       -- admin user_id who verified
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Index for fast admin lookup
CREATE INDEX IF NOT EXISTS payments_user_id_idx  ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx   ON payments(status);
CREATE INDEX IF NOT EXISTS payments_created_idx  ON payments(created_at DESC);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- User can see own payments
CREATE POLICY "users_own_payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- User can insert own payment record
CREATE POLICY "users_insert_payment" ON payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (backend)
CREATE POLICY "service_role_all" ON payments
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add payment fields to profiles (if not already present)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_status      TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_plan        TEXT,
  ADD COLUMN IF NOT EXISTS subscription_activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_utr              TEXT,
  ADD COLUMN IF NOT EXISTS payment_txn_id           TEXT;

COMMENT ON TABLE payments IS 'UPI manual payment records. Verify UTR via bank portal then set status=verified.';
