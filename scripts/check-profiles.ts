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

async function checkProfiles() {
  const email = 'logangibbons1999@gmail.com';

  // Get all profiles with this email
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, tier, created_at, google_id')
    .eq('email', email);

  console.log(`Profiles for ${email}:`);
  console.log(`Total: ${profiles?.length || 0}\n`);

  profiles?.forEach((profile, i) => {
    console.log(`${i + 1}. ID: ${profile.id}`);
    console.log(`   Tier: ${profile.tier}`);
    console.log(`   Google ID: ${profile.google_id || 'null'}`);
    console.log(`   Created: ${profile.created_at}\n`);
  });

  // Check comment_scores for both IDs
  if (profiles && profiles.length > 0) {
    for (const profile of profiles) {
      const { data: scores } = await supabase
        .from('comment_scores')
        .select('comment_id, suggested_reply')
        .eq('user_id', profile.id)
        .not('suggested_reply', 'is', null);

      console.log(`Comment scores for ${profile.id}:`);
      console.log(`  ${scores?.length || 0} with suggested replies`);
    }
  }
}

checkProfiles().catch(console.error);
