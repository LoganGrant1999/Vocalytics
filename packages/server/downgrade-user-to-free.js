import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function downgradeUserToFree(email) {
  console.log(`\nDowngrading user ${email} to Free tier...`);

  const { data: user, error: findError} = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (findError || !user) {
    console.error('Error finding user:', findError?.message);
    return;
  }

  console.log(`Found user: ${user.email} (current tier: ${user.tier})`);

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({
      tier: 'free',
      subscription_status: null,
      subscribed_until: null
    })
    .eq('id', user.id)
    .select()
    .single();

  if (updateError) {
    console.error('Error downgrading user:', updateError.message);
    return;
  }

  console.log(`✅ Successfully downgraded ${email} to Free tier!`);
  console.log(`   Tier: ${updated.tier}`);
}

const email = process.argv[2] || 'logangibbons1999@gmail.com';
downgradeUserToFree(email);
