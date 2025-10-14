#!/usr/bin/env tsx
/**
 * Run Supabase migrations using the REST API
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Load env from .env.local
import { config } from 'dotenv';
config({ path: join(process.cwd(), 'packages/server/.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigrations() {
  const migrationsDir = join(process.cwd(), 'supabase/migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log('🔄 Running migrations via Supabase API...\n');

  for (const file of files) {
    console.log(`📝 Running: ${file}`);
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        process.exit(1);
      }

      console.log('   ✅ Success\n');
    } catch (err: any) {
      console.error(`   ❌ Failed: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('✅ All migrations completed!');
}

runMigrations().catch(console.error);
