-- Migration: platform_api_allowed
-- Super admin can disable platform AI API access for specific users

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS platform_api_allowed BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS platform_api_disabled_reason TEXT;

COMMENT ON COLUMN profiles.platform_api_allowed IS
  'When false, user must use their own API key. Super admin controls this.';
