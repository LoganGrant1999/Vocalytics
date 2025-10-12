#!/usr/bin/env node
/**
 * Apply RLS Migration Directly via psql-style execution
 * Uses Supabase connection string to execute migration SQL
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Supabase RLS Migration - Direct Execution');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Load environment
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
console.log(`📍 Project: ${projectRef}`);
console.log('');

// Read migration
const migrationPath = join(__dirname, '../supabase/migrations/20250110_harden_rls_privileges.sql');
const sql = readFileSync(migrationPath, 'utf8');

console.log('📄 Migration loaded:');
console.log(`   Path: ${migrationPath}`);
console.log(`   Size: ${sql.length} bytes`);
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚠️  MANUAL MIGRATION REQUIRED');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('Supabase requires SQL execution via the dashboard or CLI.');
console.log('');
console.log('🎯 Choose one method:');
console.log('');
console.log('━━━ METHOD 1: Supabase Dashboard (Recommended) ━━━');
console.log('');
console.log('1. Open SQL Editor:');
console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new`);
console.log('');
console.log('2. Copy the migration SQL:');
console.log(`   cat supabase/migrations/20250110_harden_rls_privileges.sql | pbcopy`);
console.log('   (Or manually open the file and copy contents)');
console.log('');
console.log('3. Paste into SQL Editor and click "Run"');
console.log('');
console.log('4. Verify success (should see query results at bottom)');
console.log('');
console.log('━━━ METHOD 2: Supabase CLI ━━━');
console.log('');
console.log('1. Install CLI (if not already):');
console.log('   brew install supabase/tap/supabase');
console.log('   # or: npm install -g supabase');
console.log('');
console.log('2. Login:');
console.log('   supabase login');
console.log('');
console.log('3. Link project:');
console.log(`   supabase link --project-ref ${projectRef}`);
console.log('');
console.log('4. Push migration:');
console.log('   supabase db push');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Print checklist
console.log('📋 POST-MIGRATION CHECKLIST');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('□ Run DB Linter');
console.log('  Command: supabase db lint');
console.log('');
console.log('□ Smoke Test (a): Client can SELECT own usage_events ✓');
console.log('  Test with authenticated Supabase client:');
console.log('    const { data } = await supabase.from("usage_events").select("*");');
console.log('  Expected: Returns only current user\'s rows (user_id = auth.uid())');
console.log('');
console.log('□ Smoke Test (b): Client cannot see stripe_events ✗');
console.log('  Test with authenticated Supabase client:');
console.log('    const { data, error } = await supabase.from("stripe_events").select("*");');
console.log('  Expected: Permission denied or empty result');
console.log('');
console.log('□ Smoke Test (c): Client can only read/update own users row ✓');
console.log('  Test with authenticated Supabase client:');
console.log('    // Read own row');
console.log('    const { data } = await supabase.from("users").select("*");');
console.log('    // Should return only 1 row (current user)');
console.log('');
console.log('    // Update own row');
console.log('    const userId = (await supabase.auth.getUser()).data.user.id;');
console.log('    const { error } = await supabase.from("users")');
console.log('      .update({ email: "new@example.com" })');
console.log('      .eq("id", userId);');
console.log('    // Should succeed');
console.log('');
console.log('□ Smoke Test (d): Server (service role) still writes ✓');
console.log('  Test with service role client:');
console.log('    // Write to usage_events');
console.log('    await supabaseAdmin.from("usage_events").insert({');
console.log('      user_id: someUserId,');
console.log('      action: "analyze",');
console.log('      count: 1');
console.log('    });');
console.log('');
console.log('    // Write to stripe_events');
console.log('    await supabaseAdmin.from("stripe_events").insert({');
console.log('      event_id: "evt_test",');
console.log('      type: "test",');
console.log('      payload: {}');
console.log('    });');
console.log('    // Both should succeed');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('📚 Documentation:');
console.log('   └─ Full guide: supabase/MIGRATION_SUMMARY.md');
console.log('   └─ Verification: supabase/RLS_VERIFICATION_CHECKLIST.md');
console.log('   └─ SQL checks: supabase/verify_rls.sql');
console.log('');
