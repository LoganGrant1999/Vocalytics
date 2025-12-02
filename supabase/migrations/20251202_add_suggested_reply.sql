-- Add suggested_reply column to comment_scores table
-- This caches AI-generated replies so they don't need to be re-generated on every page load

ALTER TABLE public.comment_scores
  ADD COLUMN IF NOT EXISTS suggested_reply TEXT;

-- Add timestamp for when reply was generated
ALTER TABLE public.comment_scores
  ADD COLUMN IF NOT EXISTS reply_generated_at TIMESTAMPTZ;

-- Add index for filtering comments with/without replies
CREATE INDEX IF NOT EXISTS idx_comment_scores_has_reply
  ON public.comment_scores(user_id, (suggested_reply IS NOT NULL));

COMMENT ON COLUMN public.comment_scores.suggested_reply IS 'AI-generated reply cached to avoid re-generation';
COMMENT ON COLUMN public.comment_scores.reply_generated_at IS 'Timestamp when the reply was generated';
