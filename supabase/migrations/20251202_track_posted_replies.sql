-- Track posted replies to comments
-- This allows us to show which comments have been replied to and persist across re-analyses

CREATE TABLE IF NOT EXISTS public.posted_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  reply_text TEXT NOT NULL,
  posted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Prevent duplicate replies to the same comment by the same user
  UNIQUE(user_id, comment_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_posted_replies_user_video
  ON public.posted_replies(user_id, video_id);

CREATE INDEX IF NOT EXISTS idx_posted_replies_comment
  ON public.posted_replies(user_id, comment_id);

COMMENT ON TABLE public.posted_replies IS 'Tracks which YouTube comments users have replied to via the app';
COMMENT ON COLUMN public.posted_replies.comment_id IS 'YouTube comment ID (not internal DB ID)';
COMMENT ON COLUMN public.posted_replies.reply_text IS 'The text that was posted as a reply';
