-- ============================================================
-- YouTube OAuth Tokens Migration
-- Date: 2025-10-13
-- Purpose: Add YouTube OAuth token storage to users table
-- ============================================================

-- Add YouTube OAuth token columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS youtube_access_token TEXT,
  ADD COLUMN IF NOT EXISTS youtube_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS youtube_token_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS youtube_scope TEXT,
  ADD COLUMN IF NOT EXISTS youtube_token_type TEXT;

-- RLS remains enabled on users table (set in previous migrations)
-- Existing policy "users_update_own" already allows authenticated users
-- to update only their own row (WHERE auth.uid() = app_user_id)
-- No new RLS policies needed - existing policies cover YouTube token updates

COMMENT ON COLUMN public.users.youtube_access_token IS
  'YouTube OAuth access token for API calls. Server manages via service_role.';

COMMENT ON COLUMN public.users.youtube_refresh_token IS
  'YouTube OAuth refresh token. Only returned on first consent. Server-managed.';

COMMENT ON COLUMN public.users.youtube_token_expiry IS
  'Expiry timestamp for access token. Used for proactive refresh.';

COMMENT ON COLUMN public.users.youtube_scope IS
  'Granted OAuth scopes (space-separated). Should include youtube.readonly and youtube.force-ssl.';

COMMENT ON COLUMN public.users.youtube_token_type IS
  'Token type (typically "Bearer"). Stored for OAuth2 spec compliance.';
