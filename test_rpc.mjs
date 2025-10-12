import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function testRPC() {
  const testEmail = 'test@vocalytics.dev';

  // Find user
  const { data: users, error: findError } = await supabase
    .from('users')
    .select('id, email, comments_analyzed_count')
    .or(`email.eq.${testEmail},app_user_id.ilike.%${testEmail}%`);

  if (findError) throw findError;
  if (!users || users.length === 0) throw new Error('User not found');

  const user = users[0];
  console.log(`\nUser: ${user.id}`);
  console.log(`Current count: ${user.comments_analyzed_count}\n`);

  // Test RPC call
  console.log('Testing RPC consume_analyze_quota...');
  const { data, error } = await supabase
    .rpc('consume_analyze_quota', {
      _user_id: user.id,
      _cap: 2
    });

  console.log('RPC Response:');
  console.log('  data:', JSON.stringify(data, null, 2));
  console.log('  error:', error);

  if (error) {
    console.error('\n❌ RPC call failed:', error);
  } else if (data && data.length > 0 && data[0].allowed) {
    console.log(`\n✓ RPC succeeded: allowed=${data[0].allowed}, new_count=${data[0].new_count}`);
  } else {
    console.log(`\n✗ RPC denied (count exceeded cap)`);
  }

  // Verify final count
  const { data: updatedUsers, error: verifyError } = await supabase
    .from('users')
    .select('id, comments_analyzed_count')
    .eq('id', user.id)
    .single();

  if (verifyError) throw verifyError;
  console.log(`\nFinal count: ${updatedUsers.comments_analyzed_count}`);
}

testRPC().catch(console.error);
