-- Create comment_sentiments table for incremental analysis
-- Stores sentiment analysis results for individual comments to enable reuse

CREATE TABLE IF NOT EXISTS comment_sentiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  text_hash TEXT NOT NULL, -- SHA256 hash of comment text for change detection
  sentiment JSONB NOT NULL, -- { positive, neutral, negative }
  category TEXT NOT NULL, -- positive, neutral, constructive, negative, spam
  topics TEXT[] DEFAULT '{}', -- Array of topic strings
  intent TEXT, -- appreciation, suggestion, critique, promotion, question, other
  toxicity NUMERIC(3,2) DEFAULT 0.0, -- 0.0 to 1.0
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_comment_sentiments_user_video ON comment_sentiments(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_comment_sentiments_text_hash ON comment_sentiments(text_hash);
CREATE INDEX IF NOT EXISTS idx_comment_sentiments_comment_id ON comment_sentiments(comment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_sentiments_unique ON comment_sentiments(user_id, video_id, comment_id);

-- Add comment for documentation
COMMENT ON TABLE comment_sentiments IS 'Stores individual comment sentiment analysis results for incremental analysis and reuse';
COMMENT ON COLUMN comment_sentiments.text_hash IS 'SHA256 hash of comment text to detect changes';
COMMENT ON COLUMN comment_sentiments.sentiment IS 'Sentiment scores as JSON: {positive: number, neutral: number, negative: number}';
