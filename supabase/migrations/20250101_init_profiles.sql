-- ============================================================
-- Initial Profiles Table Migration
-- Date: 2025-01-01
-- Purpose: Create profiles table for user data
-- ============================================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  subscription_status TEXT,
  subscribed_until TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  comments_analyzed_count INTEGER DEFAULT 0,
  replies_generated_count INTEGER DEFAULT 0,
  reset_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS profiles_google_id_idx ON public.profiles(google_id);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx ON public.profiles(stripe_customer_id);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "profiles self-select"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "profiles self-update"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Grant permissions
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Comments
COMMENT ON TABLE public.profiles IS 'User profiles with subscription and usage tracking';
COMMENT ON COLUMN public.profiles.google_id IS 'Google user ID from OAuth';
COMMENT ON COLUMN public.profiles.tier IS 'Subscription tier: free or pro';
