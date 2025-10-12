import pg from 'pg';
import { readFileSync } from 'fs';

const connectionString = 'postgresql://postgres.aveujrwionxljrutvsze:VocalyticsSuperSecure2024!@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

const client = new pg.Client({ connectionString });

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database');

    const sql = readFileSync('supabase/migrations/20251011_atomic_quota.sql', 'utf8');

    console.log('Executing migration SQL...\n');
    await client.query(sql);

    console.log('✓ Migration applied successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration();
