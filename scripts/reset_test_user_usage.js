#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_EMAIL = 'test@vocalytics.dev' } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function resetTestUserUsage() {
  try {
    // Find test user in auth.users
    const { data: users, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) {
      console.error('❌ Failed to list users:', listErr.message);
      process.exit(1);
    }

    const user = users.users.find(u => u.email?.toLowerCase() === TEST_EMAIL.toLowerCase());
    if (!user) {
      console.error(`❌ Test user not found: ${TEST_EMAIL}`);
      process.exit(1);
    }

    // Reset counts and Stripe fields in public.users
    const { error: updErr } = await admin
      .from('users')
      .update({
        comments_analyzed_count: 0,
        replies_generated_count: 0,
        // Clear invalid Stripe customer ID to allow fresh checkout
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_status: null,
        subscribed_until: null,
        tier: 'free'
      })
      .eq('id', user.id);

    if (updErr) {
      console.error('❌ Failed to reset counters:', updErr.message);
      process.exit(1);
    }

    // Optional: try calling reset procs; ignore if missing
    try {
      await admin.rpc('reset_daily_replies');
    } catch (err) {
      // Ignore if proc doesn't exist
    }
    try {
      await admin.rpc('reset_weekly_comments');
    } catch (err) {
      // Ignore if proc doesn't exist
    }

    // Verify reset
    const { data: row, error: readErr } = await admin
      .from('users')
      .select('id, email, comments_analyzed_count, replies_generated_count')
      .eq('id', user.id)
      .single();

    if (readErr) {
      console.error('❌ Failed to verify reset:', readErr.message);
      process.exit(1);
    }

    console.log('✅ reset_test_user_usage', JSON.stringify({
      userId: row.id,
      email: row.email,
      comments_analyzed_count: row.comments_analyzed_count,
      replies_generated_count: row.replies_generated_count
    }));

    process.exit(0);
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

resetTestUserUsage();
