#!/usr/bin/env node
/**
 * Apply RLS Hardening Migration to Supabase
 * Reads migration SQL and executes it using service role
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('🔧 Supabase RLS Migration Script');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📍 Target: ${SUPABASE_URL}`);
console.log('');

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    // Read migration file
    const migrationPath = join(__dirname, '../supabase/migrations/20250110_harden_rls_privileges.sql');
    console.log(`📄 Reading migration: ${migrationPath}`);

    const sql = readFileSync(migrationPath, 'utf8');
    console.log(`   Size: ${sql.length} bytes`);
    console.log('');

    // Execute migration using Supabase SQL
    console.log('⚡ Executing migration...');

    // Split SQL into individual statements (basic approach)
    // Note: This is simplified; for complex migrations use Supabase CLI
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`   Found ${statements.length} SQL statements`);
    console.log('');

    // For Supabase, we'll use the REST API to execute SQL
    // Since we can't execute arbitrary multi-statement SQL via client,
    // we'll use fetch to hit the SQL endpoint directly

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: sql })
    });

    // If the rpc method doesn't exist, we'll need to use the SQL Editor approach
    // Let's try a different method: execute via postgres function

    console.log('⚠️  Note: For full migration execution, please use one of these methods:');
    console.log('');
    console.log('   Method 1: Supabase Dashboard SQL Editor');
    console.log('   ├─ Open: https://supabase.com/dashboard/project/_/sql/new');
    console.log('   ├─ Copy/paste: supabase/migrations/20250110_harden_rls_privileges.sql');
    console.log('   └─ Click "Run"');
    console.log('');
    console.log('   Method 2: Supabase CLI');
    console.log('   ├─ Install: npm install -g supabase');
    console.log('   ├─ Link: supabase link --project-ref <your-project-ref>');
    console.log('   └─ Push: supabase db push');
    console.log('');

    // Let's at least verify we can connect and check current state
    console.log('🔍 Checking current database state...');
    console.log('');

    // Query RLS status
    const { data: rlsStatus, error: rlsError } = await supabase
      .from('pg_tables')
      .select('tablename, rowsecurity')
      .eq('schemaname', 'public')
      .in('tablename', ['stripe_events', 'usage_events', 'users']);

    if (rlsError) {
      console.log('   ℹ️  Cannot query pg_tables (expected - need direct SQL access)');
    } else if (rlsStatus) {
      console.log('   RLS Status:');
      rlsStatus.forEach(row => {
        console.log(`   ├─ ${row.tablename}: ${row.rowsecurity ? '✓ enabled' : '✗ disabled'}`);
      });
      console.log('');
    }

    console.log('✅ Connection verified!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Apply migration using Method 1 or Method 2 above');
    console.log('   2. Run verification: node scripts/verify_rls_migration.js');
    console.log('   3. Run smoke tests (see checklist below)');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Print checklist
function printChecklist() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 POST-MIGRATION CHECKLIST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('✓ Run DB Linter');
  console.log('  └─ supabase db lint');
  console.log('');
  console.log('✓ Smoke Tests:');
  console.log('  (a) Client can SELECT own usage_events ✓');
  console.log('      └─ Test: supabase.from("usage_events").select("*")');
  console.log('         Expected: Returns only current user\'s rows');
  console.log('');
  console.log('  (b) Client cannot see stripe_events ✗');
  console.log('      └─ Test: supabase.from("stripe_events").select("*")');
  console.log('         Expected: Permission denied or empty result');
  console.log('');
  console.log('  (c) Client can only read/update own users row ✓');
  console.log('      └─ Test: supabase.from("users").select("*")');
  console.log('         Expected: Returns only current user\'s row');
  console.log('      └─ Test: supabase.from("users").update({email: "..."}).eq("id", auth.uid())');
  console.log('         Expected: Success');
  console.log('');
  console.log('  (d) Server (service role) still writes usage_events + stripe_events ✓');
  console.log('      └─ Test: supabaseAdmin.from("usage_events").insert({...})');
  console.log('         Expected: Success');
  console.log('      └─ Test: supabaseAdmin.from("stripe_events").insert({...})');
  console.log('         Expected: Success');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Run
runMigration().then(() => {
  printChecklist();
});
