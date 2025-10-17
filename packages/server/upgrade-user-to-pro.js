import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function upgradeUserToPro(email) {
  console.log(`\nUpgrading user ${email} to Pro tier...`);

  // Find user by email
  const { data: user, error: findError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (findError || !user) {
    console.error('Error finding user:', findError?.message);
    return;
  }

  console.log(`Found user: ${user.email} (current tier: ${user.tier})`);

  // Upgrade to pro
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({
      tier: 'pro',
      subscription_status: 'active',
      subscribed_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    })
    .eq('id', user.id)
    .select()
    .single();

  if (updateError) {
    console.error('Error upgrading user:', updateError.message);
    return;
  }

  console.log(`✅ Successfully upgraded ${email} to Pro tier!`);
  console.log(`   Tier: ${updated.tier}`);
  console.log(`   Status: ${updated.subscription_status}`);
  console.log(`   Valid until: ${updated.subscribed_until}`);
}

// Get email from command line or use default
const email = process.argv[2] || 'logangibbons1999@gmail.com';
upgradeUserToPro(email);
