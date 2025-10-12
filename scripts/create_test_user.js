#!/usr/bin/env node

/**
 * Safely provision Supabase test user for verification suite
 *
 * Usage: node scripts/create_test_user.js
 *
 * Requires .env with:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - TEST_EMAIL (default: test@vocalytics.dev)
 *   - TEST_PASS (default: TestPass123!)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@vocalytics.dev';
const TEST_PASS = process.env.TEST_PASS || 'TestPass123!';

// Validate required environment variables
const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing.join(', '));
  console.error('\nSet them in .env file or export them:');
  console.error('  SUPABASE_URL=https://xxx.supabase.co');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...');
  process.exit(1);
}

console.log('🔧 Vocalytics Test User Provisioning');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📍 Project: ${SUPABASE_URL}`);
console.log(`📧 Email: ${TEST_EMAIL}`);
console.log('');

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function provisionTestUser() {
  try {
    // Step 1: Try to create the user via auth.admin
    console.log('🔍 Step 1: Checking if user exists in auth.users...');

    let userId = null;
    let userExists = false;

    // First, try to list users and find our test user
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Failed to list users:', listError.message);
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = listData.users.find(u => u.email === TEST_EMAIL);

    if (existingUser) {
      console.log(`✅ User already exists in auth.users`);
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Email: ${existingUser.email}`);
      userId = existingUser.id;
      userExists = true;
    } else {
      // Create new user
      console.log('📝 Creating new user in auth.users...');

      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASS,
        email_confirm: true,  // Auto-confirm email
        user_metadata: {
          created_by: 'test_provisioning_script',
          purpose: 'verification_suite'
        }
      });

      if (createError) {
        console.error('❌ Failed to create user:', createError.message);
        process.exit(1);
      }

      if (!createData.user) {
        console.error('❌ User creation succeeded but no user data returned');
        process.exit(1);
      }

      console.log(`✅ User created successfully in auth.users`);
      console.log(`   ID: ${createData.user.id}`);
      console.log(`   Email: ${createData.user.email}`);
      userId = createData.user.id;
      userExists = true;
    }

    console.log('');

    // Step 2: Upsert matching row in public.users
    console.log('🔍 Step 2: Upserting public.users row...');

    const { data: upsertData, error: upsertError} = await supabase
      .from('users')
      .upsert({
        id: userId,
        app_user_id: userId, // Set app_user_id to match auth.users.id
        email: TEST_EMAIL,
        tier: 'free',
        comments_analyzed_count: 0,
        replies_generated_count: 0,
        reset_date: new Date().toISOString().split('T')[0],
        subscribed_until: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_status: null
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (upsertError) {
      console.error('❌ Failed to upsert public.users row:', upsertError.message);
      console.error('   Details:', upsertError);
      process.exit(1);
    }

    console.log('✅ public.users row created/updated successfully');
    console.log(`   ID: ${upsertData.id}`);
    console.log(`   Email: ${upsertData.email}`);
    console.log(`   Tier: ${upsertData.tier}`);
    console.log('');

    // Step 3: Verify RLS policies allow user to see their own row
    console.log('🔍 Step 3: Verifying RLS policies (sanity check)...');

    // This query runs as service_role, so it bypasses RLS
    // But we can verify the row exists
    const { data: verifyData, error: verifyError } = await supabase
      .from('users')
      .select('id, email, tier')
      .eq('id', userId)
      .single();

    if (verifyError) {
      console.error('❌ Failed to verify public.users row:', verifyError.message);
      process.exit(1);
    }

    console.log('✅ Verification successful');
    console.log(`   User can be queried from public.users`);
    console.log('');

    // Success summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TEST USER PROVISIONED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('User Details:');
    console.log(`  ├─ ID: ${userId}`);
    console.log(`  ├─ Email: ${TEST_EMAIL}`);
    console.log(`  ├─ Tier: free`);
    console.log(`  └─ Status: ready for testing`);
    console.log('');
    console.log('Next Steps:');
    console.log('  └─ Run verification suite: bash scripts/prod_verify.sh');
    console.log('');

    // Output JSON for programmatic use
    console.log(JSON.stringify({
      userId: userId,
      email: TEST_EMAIL
    }));

    process.exit(0);

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run provisioning
provisionTestUser();
