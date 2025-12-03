-- Add dismissed column to comment_scores to allow users to clear comments from inbox
ALTER TABLE comment_scores
ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT FALSE;

-- Add index for faster queries filtering by dismissed status
CREATE INDEX IF NOT EXISTS idx_comment_scores_dismissed
ON comment_scores(user_id, dismissed)
WHERE dismissed = FALSE;
