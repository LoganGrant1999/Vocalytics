import { readFileSync } from 'fs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Read and combine all migrations in order
const migrations = [
  './supabase/migrations/20250101_init_profiles.sql',
  './supabase/migrations/20250110_harden_rls_privileges.sql',
  './supabase/migrations/20251011_atomic_quota.sql',
  './supabase/migrations/20251013_youtube_oauth_tokens.sql',
  './supabase/migrations/20251015_channel_persistence.sql',
];

console.log('='.repeat(80));
console.log('MANUAL MIGRATION REQUIRED');
console.log('='.repeat(80));
console.log('\nYour Supabase database is missing tables. Please run these migrations:');
console.log('\n1. Go to: https://supabase.com/dashboard/project/aveujrwionxljrutvsze/sql/new');
console.log('2. Copy and paste each SQL file below into the SQL editor');
console.log('3. Click "Run" for each migration\n');
console.log('='.repeat(80));

migrations.forEach((file, idx) => {
  console.log(`\n--- MIGRATION ${idx + 1}: ${file.split('/').pop()} ---\n`);
  try {
    const sql = readFileSync(file, 'utf-8');
    console.log(sql);
    console.log('\n' + '='.repeat(80));
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
  }
});

console.log('\n✅ After running all migrations, restart your backend server.\n');
