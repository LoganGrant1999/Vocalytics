import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../packages/server/.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runMigrations() {
  console.log('Running production migrations...\n');
  console.log('Note: You need to run these SQL commands manually in the Supabase dashboard or via psql.\n');
  console.log('Dashboard: https://supabase.com/dashboard/project/aveujrwionxljrutvsze/editor\n');
  console.log('='.repeat(80));

  console.log('\nMIGRATION 1: Add dismissed column to comment_scores');
  console.log('='.repeat(80));
  console.log(`
-- Add dismissed column to comment_scores to allow users to clear comments from inbox
ALTER TABLE comment_scores
ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT FALSE;

-- Add index for faster queries filtering by dismissed status
CREATE INDEX IF NOT EXISTS idx_comment_scores_dismissed
ON comment_scores(user_id, dismissed)
WHERE dismissed = FALSE;
  `);

  console.log('\nMIGRATION 2: Create posted_replies table');
  console.log('='.repeat(80));
  console.log(`
-- Track posted replies to comments
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
  `);

  console.log('\n' + '='.repeat(80));
  console.log('\nCopy and paste these SQL commands into the Supabase SQL Editor.');
  console.log('Dashboard URL: https://supabase.com/dashboard/project/aveujrwionxljrutvsze/editor');
}

runMigrations();
