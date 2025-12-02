-- Fix tone_profiles foreign key to reference profiles instead of auth.users
-- Date: 2025-12-01

ALTER TABLE public.tone_profiles
  DROP CONSTRAINT IF EXISTS tone_profiles_user_id_fkey;

ALTER TABLE public.tone_profiles
  ADD CONSTRAINT tone_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT tone_profiles_user_id_fkey ON public.tone_profiles IS 'Foreign key to profiles table (not auth.users)';
