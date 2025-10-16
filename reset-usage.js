import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetUsage() {
  const userId = '9417b05a-e6ec-496a-b8fe-435f8a4cdb13';

  const { data, error } = await supabase
    .from('profiles')
    .update({
      comments_analyzed_count: 0,
      replies_generated_count: 0
    })
    .eq('id', userId)
    .select();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Usage reset successfully:', data);
  }
}

resetUsage();
