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

async function checkProfile() {
  const email = 'logangibbons1999@gmail.com';

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, tier, subscription_status, subscribed_until, email')
    .eq('email', email)
    .single();

  console.log('Profile lookup result:');
  console.log('  Error:', error);
  console.log('  Data:', profile);

  if (profile) {
    // Try the same query as enforceReply
    const { data: profile2, error: error2 } = await supabase
      .from('profiles')
      .select('id, tier, subscription_status, subscribed_until')
      .eq('id', profile.id)
      .single();

    console.log('\nEnforceReply query result (by ID):');
    console.log('  Error:', error2);
    console.log('  Data:', profile2);
  }
}

checkProfile().catch(console.error);
