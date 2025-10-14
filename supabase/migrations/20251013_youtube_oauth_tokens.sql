-- ============================================================
-- YouTube OAuth Tokens Migration
-- Date: 2025-10-13
-- Purpose: Add YouTube OAuth token storage to profiles table
-- ============================================================

-- Add YouTube OAuth token columns to profiles table (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS youtube_access_token TEXT,
  ADD COLUMN IF NOT EXISTS youtube_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS youtube_token_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS youtube_scope TEXT,
  ADD COLUMN IF NOT EXISTS youtube_token_type TEXT;

-- Ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create self-update policy (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'profiles self-update'
  ) THEN
    CREATE POLICY "profiles self-update"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;
END$$;

-- Add column comments for documentation
COMMENT ON COLUMN public.profiles.youtube_access_token IS
  'YouTube OAuth access token for API calls. Server manages via service_role.';

COMMENT ON COLUMN public.profiles.youtube_refresh_token IS
  'YouTube OAuth refresh token. Only returned on first consent. Server-managed.';

COMMENT ON COLUMN public.profiles.youtube_token_expiry IS
  'Expiry timestamp for access token. Used for proactive refresh.';

COMMENT ON COLUMN public.profiles.youtube_scope IS
  'Granted OAuth scopes (space-separated). Should include youtube.readonly and youtube.force-ssl.';

COMMENT ON COLUMN public.profiles.youtube_token_type IS
  'Token type (typically "Bearer"). Stored for OAuth2 spec compliance.';
