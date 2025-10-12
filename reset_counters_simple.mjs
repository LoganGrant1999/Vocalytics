import { createClient } from '@supabase/supabase-js';

import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetCounters() {
  const testEmail = 'test@vocalytics.dev';

  console.log(`Resetting counters for ${testEmail}...`);

  // Find user by app_user_id matching email
  const { data: users, error: findError } = await supabase
    .from('users')
    .select('id, app_user_id, email, comments_analyzed_count, replies_generated_count')
    .or(`email.eq.${testEmail},app_user_id.ilike.%${testEmail}%`);

  if (findError) {
    console.error('Error finding user:', findError);
    throw findError;
  }

  if (!users || users.length === 0) {
    console.error(`No user found with email ${testEmail}`);
    throw new Error('User not found');
  }

  const user = users[0];
  console.log(`Found user: ${user.id}`);
  console.log(`  Current: analyze=${user.comments_analyzed_count}, reply=${user.replies_generated_count}`);

  // Reset counters
  const { error: updateError } = await supabase
    .from('users')
    .update({
      comments_analyzed_count: 0,
      replies_generated_count: 0
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('Error resetting counters:', updateError);
    throw updateError;
  }

  // Verify reset
  const { data: updatedUser, error: verifyError } = await supabase
    .from('users')
    .select('id, email, comments_analyzed_count, replies_generated_count')
    .eq('id', user.id)
    .single();

  if (verifyError) {
    console.error('Error verifying reset:', verifyError);
    throw verifyError;
  }

  console.log('✓ Counters reset successfully:');
  console.log(`  comments_analyzed_count: ${updatedUser.comments_analyzed_count}`);
  console.log(`  replies_generated_count: ${updatedUser.replies_generated_count}`);
}

resetCounters().catch(console.error);
