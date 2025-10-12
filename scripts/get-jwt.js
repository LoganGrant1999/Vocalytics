#!/usr/bin/env node

/**
 * Get Supabase JWT via email/password authentication
 * Usage: SUPABASE_URL=... SUPABASE_ANON=... TEST_EMAIL=... TEST_PASS=... node get-jwt.js
 * Outputs: JWT token to STDOUT (only)
 * Exit codes: 0 on success, 1 on failure
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON;
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASS = process.env.TEST_PASS;

// Validate required environment variables
const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!SUPABASE_ANON) missing.push('SUPABASE_ANON');
if (!TEST_EMAIL) missing.push('TEST_EMAIL');
if (!TEST_PASS) missing.push('TEST_PASS');

if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('\nUsage:');
  console.error('  SUPABASE_URL=https://xxx.supabase.co \\');
  console.error('  SUPABASE_ANON=eyJhbGc... \\');
  console.error('  TEST_EMAIL=test@example.com \\');
  console.error('  TEST_PASS=password123 \\');
  console.error('  node scripts/get-jwt.js');
  process.exit(1);
}

async function getJWT() {
  try {
    // Create Supabase client with anon key
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

    // Attempt sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASS
    });

    if (error) {
      console.error(`❌ Authentication failed: ${error.message}`);
      if (error.message.includes('Invalid login credentials')) {
        console.error('\nHint: Check TEST_EMAIL and TEST_PASS are correct.');
        console.error('      Create user in Supabase Dashboard > Authentication > Users if needed.');
      }
      process.exit(1);
    }

    if (!data.session || !data.session.access_token) {
      console.error('❌ No session or access token returned');
      process.exit(1);
    }

    // Output ONLY the token to STDOUT
    console.log(data.session.access_token);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Unexpected error: ${err.message}`);
    process.exit(1);
  }
}

getJWT();
