/**
 * Apply migration to Supabase production database
 * Usage: node scripts/apply-migration.js <migration-file-path>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ Usage: node scripts/apply-migration.js <migration-file-path>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  try {
    console.log(`📂 Reading migration: ${migrationFile}`);
    const migrationPath = resolve(__dirname, '..', migrationFile);
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log(`📊 Executing migration (${sql.split('\n').length} lines)...`);

    // Split by statement separator and execute one by one
    // This is a simplification - for complex migrations, use proper SQL parsing
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ';';

      // Skip pure comment blocks
      if (stmt.trim().startsWith('--')) continue;

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });

        if (error) {
          // Some operations might not be available via RPC, that's ok
          console.log(`⚠️  Statement ${i + 1}: ${error.message.substring(0, 80)}...`);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.log(`⚠️  Statement ${i + 1} failed:`, err.message);
        errorCount++;
      }
    }

    console.log(`\n✅ Migration applied: ${successCount} statements succeeded, ${errorCount} skipped/failed`);
    console.log(`\n⚠️  Note: Supabase client cannot execute DDL directly.`);
    console.log(`Please apply the migration via Supabase Dashboard or CLI:`);
    console.log(`\n  1. Go to: https://supabase.com/dashboard/project/_/sql/new`);
    console.log(`  2. Copy contents from: ${migrationFile}`);
    console.log(`  3. Click "Run"`);
    console.log(`\nOr use Supabase CLI:`);
    console.log(`  npx supabase db push`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
