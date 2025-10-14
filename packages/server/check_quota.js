import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkQuota() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, google_id, comments_analyzed_count, replies_generated_count, reset_date')
    .neq('google_id', '');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('Current quota status:');
  data.forEach(profile => {
    console.log(`\nUser: ${profile.email || profile.id}`);
    console.log(`  Comments analyzed: ${profile.comments_analyzed_count}`);
    console.log(`  Replies generated: ${profile.replies_generated_count}`);
    console.log(`  Last reset: ${profile.reset_date}`);
  });

  process.exit(0);
}

checkQuota();
