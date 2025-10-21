-- ============================================================
-- Tone Profiles and Priority Settings Migration
-- Date: 2025-10-19
-- Purpose: Add tone learning, priority filters, and update quota system
-- ============================================================

-- ============================================================
-- 1. UPDATE PROFILES TABLE - Remove comment analysis quota, keep reply quota
-- ============================================================

-- Drop the old comment analysis counter (FREE tier now has unlimited analysis)
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS comments_analyzed_count;

-- Rename reply counter to be more explicit
ALTER TABLE public.profiles
  RENAME COLUMN replies_generated_count TO replies_weekly_count;

-- Reset date is already there, but make sure it's weekly-focused
COMMENT ON COLUMN public.profiles.reset_date IS 'Weekly reset date for replies_weekly_count (resets every Monday)';

-- ============================================================
-- 2. CREATE TONE_PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tone_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Analysis results
  tone VARCHAR(50), -- casual/professional/enthusiastic/etc
  formality_level VARCHAR(50), -- very_casual/casual/neutral/formal
  emoji_usage VARCHAR(50), -- never/rarely/sometimes/frequently
  common_emojis TEXT[], -- ['😊', '❤️', '🎉']
  avg_reply_length VARCHAR(50), -- short/medium/long
  common_phrases TEXT[], -- phrases they use often
  uses_name BOOLEAN DEFAULT false,
  asks_questions BOOLEAN DEFAULT false,
  uses_commenter_name BOOLEAN DEFAULT false,

  -- Raw data for reference
  example_replies TEXT[], -- their actual past replies
  analysis_prompt TEXT, -- the prompt used for analysis

  -- Metadata
  learned_from_count INTEGER DEFAULT 0, -- how many replies analyzed
  learned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS tone_profiles_user_id_idx ON public.tone_profiles(user_id);

-- RLS
ALTER TABLE public.tone_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tone_profiles_select_own"
  ON public.tone_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tone_profiles_update_own"
  ON public.tone_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tone_profiles_insert_own"
  ON public.tone_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.tone_profiles IS 'User tone profiles learned from past replies';
COMMENT ON COLUMN public.tone_profiles.tone IS 'Overall tone: casual, professional, enthusiastic, etc.';
COMMENT ON COLUMN public.tone_profiles.formality_level IS 'Formality: very_casual, casual, neutral, formal';

-- ============================================================
-- 3. CREATE REPLY_SETTINGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reply_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Priority filters (Pro only)
  prioritize_subscribers BOOLEAN DEFAULT true,
  prioritize_questions BOOLEAN DEFAULT true,
  prioritize_title_keywords BOOLEAN DEFAULT true,
  prioritize_negative BOOLEAN DEFAULT true,
  prioritize_verified BOOLEAN DEFAULT false,
  prioritize_large_channels BOOLEAN DEFAULT false,
  prioritize_first_time BOOLEAN DEFAULT false,
  prioritize_popular BOOLEAN DEFAULT false, -- >5 likes

  -- Custom keywords
  custom_keywords TEXT[], -- e.g., ['source code', 'tutorial', 'part 2']

  -- Auto-ignore rules
  ignore_spam BOOLEAN DEFAULT true,
  ignore_generic_praise BOOLEAN DEFAULT false,
  ignore_links BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.reply_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reply_settings_select_own"
  ON public.reply_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "reply_settings_update_own"
  ON public.reply_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reply_settings_insert_own"
  ON public.reply_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.reply_settings IS 'User preferences for comment prioritization and auto-ignore rules';
COMMENT ON COLUMN public.reply_settings.prioritize_subscribers IS 'Pro only: Boost comments from channel subscribers';

-- Trigger to create default settings on user creation
CREATE OR REPLACE FUNCTION public.create_default_reply_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.reply_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created_reply_settings'
  ) THEN
    CREATE TRIGGER on_auth_user_created_reply_settings
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.create_default_reply_settings();
  END IF;
END$$;

-- ============================================================
-- 4. CREATE COMMENT_SCORES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comment_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL,
  video_id TEXT NOT NULL,

  -- Scoring
  priority_score INTEGER, -- 0-100
  reasons TEXT[], -- ["From subscriber", "Contains question"]
  should_auto_reply BOOLEAN DEFAULT false,

  -- Comment metadata (cached from YouTube)
  comment_text TEXT,
  author_name TEXT,
  author_channel_id TEXT,
  is_subscriber BOOLEAN,
  like_count INTEGER,
  published_at TIMESTAMPTZ,

  -- Analysis
  sentiment VARCHAR(20), -- positive/neutral/negative
  is_question BOOLEAN,
  is_spam BOOLEAN,

  -- Metadata
  scored_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, comment_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_comment_scores_user_video ON public.comment_scores(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_comment_scores_priority ON public.comment_scores(user_id, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_comment_scores_user_id ON public.comment_scores(user_id);

-- RLS
ALTER TABLE public.comment_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_scores_select_own"
  ON public.comment_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "comment_scores_insert_own"
  ON public.comment_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comment_scores_update_own"
  ON public.comment_scores FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comment_scores_delete_own"
  ON public.comment_scores FOR DELETE
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.comment_scores IS 'Cached priority scores for comments to avoid re-computing';
COMMENT ON COLUMN public.comment_scores.priority_score IS '0-100 score based on user priority settings';
COMMENT ON COLUMN public.comment_scores.reasons IS 'Human-readable reasons for the score';

-- ============================================================
-- 5. MIGRATION COMPLETE
-- ============================================================

-- Summary:
-- ✅ Removed comments_analyzed_count (unlimited analysis for free tier)
-- ✅ Renamed replies_generated_count → replies_weekly_count
-- ✅ Created tone_profiles table with RLS
-- ✅ Created reply_settings table with RLS and auto-creation trigger
-- ✅ Created comment_scores table with RLS
-- ✅ All tables have proper indexes
