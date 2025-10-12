import { readFileSync } from 'fs';

const supabaseUrl = 'https://aveujrwionxljrutvsze.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2ZXVqcndpb254bGpydXR2c3plIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTUzNTc3MSwiZXhwIjoyMDUxMTExNzcxfQ.pPFXAKj9S9H8YGiZf5h5nkI1oV84qDvHmfpO5hgPdSc';

const sql = readFileSync('supabase/migrations/20251011_atomic_quota.sql', 'utf8');

console.log('Applying migration via Supabase SQL Editor API...\n');

// Execute the full SQL as one statement
const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  },
  body: JSON.stringify({ query: sql })
});

if (!response.ok) {
  const error = await response.text();
  console.error('Error applying migration:', error);
  process.exit(1);
}

const result = await response.json();
console.log('Migration applied successfully!');
console.log('Result:', result);
