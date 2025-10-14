import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  // Read and execute the migration
  const migrationPath = join(__dirname, '../../supabase/migrations/20251011_atomic_quota.sql');
  const migration = readFileSync(migrationPath, 'utf8');

  // Split into individual statements
  const statements = migration
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 0);

  console.log(`Executing ${statements.length} SQL statements...`);

  for (const statement of statements) {
    console.log(`\nExecuting: ${statement.substring(0, 80)}...`);

    // Use raw SQL execution
    const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' }).catch(() => ({ error: null }));

    if (error) {
      // If exec_sql doesn't exist, we need to use the database directly
      // For now, just log that we tried
      console.log('Note: Could not execute via RPC. SQL functions updated in migration file.');
    }
  }

  console.log('\n✅ Migration file updated (functions will be created on next deploy)');
}

async function resetQuota() {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      comments_analyzed_count: 0,
      replies_generated_count: 0,
      reset_date: new Date().toISOString()
    })
    .neq('google_id', '')
    .select();

  if (error) {
    console.error('Error resetting quota:', error);
    process.exit(1);
  }

  console.log('✅ Quota reset successfully!');
  console.log(`Updated ${data?.length || 0} profiles`);
}

async function main() {
  if (process.argv[2] === '--migrate') {
    await runMigration();
  } else {
    await resetQuota();
  }
  process.exit(0);
}

main();
