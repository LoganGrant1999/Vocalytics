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

async function clearDatabase() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('⚠️  WARNING: This will delete ALL data from the database!');
  console.log('Starting database cleanup in 3 seconds...\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    // Order matters due to foreign key constraints
    // Delete child tables first, then parent tables

    console.log('Deleting posted_replies...');
    const { error: e1 } = await supabase.from('posted_replies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e1) console.error('Error:', e1);

    console.log('Deleting reply_queue...');
    const { error: e2 } = await supabase.from('reply_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e2) console.error('Error:', e2);

    console.log('Deleting comment_scores...');
    const { error: e3 } = await supabase.from('comment_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e3) console.error('Error:', e3);

    console.log('Deleting video_analyses...');
    const { error: e4 } = await supabase.from('video_analyses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e4) console.error('Error:', e4);

    console.log('Deleting user_videos...');
    const { error: e5 } = await supabase.from('user_videos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e5) console.error('Error:', e5);

    console.log('Deleting tone_profiles...');
    const { error: e6 } = await supabase.from('tone_profiles').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
    if (e6) console.error('Error:', e6);

    console.log('Deleting usage_counters...');
    const { error: e7 } = await supabase.from('usage_counters').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
    if (e7) console.error('Error:', e7);

    console.log('Deleting profiles...');
    const { error: e8 } = await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e8) console.error('Error:', e8);

    console.log('\n✅ Database cleared successfully!');
    console.log('You can now test with a fresh database.\n');

  } catch (error: any) {
    console.error('❌ Error clearing database:', error.message);
    process.exit(1);
  }
}

clearDatabase();
