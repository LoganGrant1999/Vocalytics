import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aveujrwionxljrutvsze.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2ZXVqcndpb254bGpydXR2c3plIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTUzNTc3MSwiZXhwIjoyMDUxMTExNzcxfQ.pPFXAKj9S9H8YGiZf5h5nkI1oV84qDvHmfpO5hgPdSc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetCounters() {
  const testEmail = 'test@vocalytics.dev';

  console.log(`Resetting counters for ${testEmail}...`);

  // Find the user
  const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('Error fetching auth users:', authError);
    throw authError;
  }

  const testUser = authUser.users.find(u => u.email === testEmail);

  if (!testUser) {
    console.error(`Test user ${testEmail} not found`);
    throw new Error('Test user not found');
  }

  console.log(`Found test user: ${testUser.id}`);

  // Reset counters in public.users table
  const { error: updateError } = await supabase
    .from('users')
    .update({
      comments_analyzed_count: 0,
      replies_generated_count: 0
    })
    .eq('id', testUser.id);

  if (updateError) {
    console.error('Error resetting counters:', updateError);
    throw updateError;
  }

  // Verify reset
  const { data: updatedUser, error: verifyError } = await supabase
    .from('users')
    .select('id, email, comments_analyzed_count, replies_generated_count')
    .eq('id', testUser.id)
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
