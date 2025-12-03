import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAccount(email: string) {
  console.log(`🔍 Looking for account: ${email}`);

  // First, get the user ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, tier')
    .eq('email', email)
    .single();

  if (profileError || !profile) {
    console.error('❌ Account not found');
    return;
  }

  console.log(`✅ Found account: ${profile.email} (${profile.tier} tier)`);
  console.log(`🗑️  Deleting all related data...`);

  const userId = profile.id;

  // Delete in order (child tables first due to foreign key constraints)
  await supabase.from('comment_scores').delete().eq('user_id', userId);
  await supabase.from('video_analyses').delete().eq('user_id', userId);
  await supabase.from('reply_queue').delete().eq('user_id', userId);
  await supabase.from('user_videos').delete().eq('user_id', userId);
  await supabase.from('tone_profiles').delete().eq('user_id', userId);
  await supabase.from('usage_counters').delete().eq('user_id', userId);
  await supabase.from('reply_settings').delete().eq('user_id', userId);

  // Finally delete the profile
  const { error: deleteError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (deleteError) {
    console.error('❌ Error deleting profile:', deleteError);
  } else {
    console.log('✅ Account successfully deleted!');
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('Usage: tsx scripts/delete-account.ts <email>');
  process.exit(1);
}

deleteAccount(email).catch(console.error);
