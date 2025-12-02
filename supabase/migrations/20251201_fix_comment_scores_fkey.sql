-- Fix comment_scores foreign key to reference profiles instead of auth.users
-- Date: 2025-12-01

-- Drop the existing foreign key constraint
ALTER TABLE public.comment_scores
  DROP CONSTRAINT IF EXISTS comment_scores_user_id_fkey;

-- Add the correct foreign key to profiles table
ALTER TABLE public.comment_scores
  ADD CONSTRAINT comment_scores_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Comment
COMMENT ON CONSTRAINT comment_scores_user_id_fkey ON public.comment_scores IS 'Foreign key to profiles table (not auth.users)';
