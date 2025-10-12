import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://aveujrwionxljrutvsze.supabase.co';
const supabaseKey = 'sb_secret_Kk9UGS5hh_v4rxEOZKziPg_Y79AXYVH';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  const sql = readFileSync(join(__dirname, 'supabase/migrations/20251011_atomic_quota.sql'), 'utf8');

  console.log('Applying migration...');

  // Split on semicolons and execute each statement
  const statements = sql.split(';').filter(s => s.trim().length > 0);

  for (const statement of statements) {
    const trimmed = statement.trim();
    if (!trimmed) continue;

    console.log(`Executing: ${trimmed.substring(0, 60)}...`);
    const { error } = await supabase.rpc('exec_sql', { sql: trimmed });

    if (error) {
      console.error('Error:', error);
      throw error;
    }
  }

  console.log('Migration applied successfully!');
}

applyMigration().catch(console.error);
