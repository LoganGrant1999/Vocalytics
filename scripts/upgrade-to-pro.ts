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

async function upgradeUserToPro(email: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log(`Upgrading ${email} to Pro...`);

  const { data, error } = await supabase
    .from('profiles')
    .update({
      tier: 'pro',
      subscription_status: 'active',
    })
    .eq('email', email)
    .select('id, email, tier, subscription_status');

  if (error) {
    console.error('Error upgrading user:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  console.log('✅ Successfully upgraded user to Pro:');
  console.log(data[0]);
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/upgrade-to-pro.ts <email>');
  process.exit(1);
}

upgradeUserToPro(email);
