// Run migration to add suggested_reply column
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, 'packages/server/.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('Running migration: add suggested_reply column...');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE public.comment_scores
        ADD COLUMN IF NOT EXISTS suggested_reply TEXT,
        ADD COLUMN IF NOT EXISTS reply_generated_at TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_comment_scores_has_reply
        ON public.comment_scores(user_id, (suggested_reply IS NOT NULL));

      COMMENT ON COLUMN public.comment_scores.suggested_reply IS 'AI-generated reply cached to avoid re-generation';
      COMMENT ON COLUMN public.comment_scores.reply_generated_at IS 'Timestamp when the reply was generated';
    `
  });

  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  console.log('Migration completed successfully!');
}

runMigration();
