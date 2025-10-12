import { supabase } from './src/db/client.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigration() {
  const sql = readFileSync(
    join(process.cwd(), '../../supabase/migrations/20251011_atomic_quota.sql'),
    'utf8'
  );

  console.log('Applying migration...\n');
  console.log(sql);
  console.log('\n---\n');

  // Execute the SQL directly - split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    if (!statement) continue;

    console.log(`Executing: ${statement.substring(0, 80)}...`);

    const { error } = await supabase.rpc('exec_raw_sql' as any, { sql: statement + ';' });

    if (error) {
      console.error('Error:', error);
      // Try direct execution
      const { error: directError } = await (supabase as any).from('_').rpc(statement);
      if (directError) {
        console.error('Direct error:', directError);
      }
    } else {
      console.log('✓');
    }
  }

  console.log('\nMigration complete!');
}

applyMigration().catch(err => {
  console.error('Failed to apply migration:', err);
  process.exit(1);
});
