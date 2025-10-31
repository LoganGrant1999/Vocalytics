/* global fetch */
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The SQL to execute
const sql1 = `
create or replace function public.consume_analyze_quota(_user_id uuid, _cap int)
returns table(allowed boolean, new_count int)
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set comments_analyzed_count = comments_analyzed_count + 1
   where id = _user_id
     and comments_analyzed_count < _cap
   returning true as allowed, comments_analyzed_count as new_count
$$;
`;

const sql2 = `
create or replace function public.consume_reply_quota(_user_id uuid, _cap int)
returns table(allowed boolean, new_count int)
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set replies_generated_count = replies_generated_count + 1
   where id = _user_id
     and replies_generated_count < _cap
   returning true as allowed, replies_generated_count as new_count
$$;
`;

async function apply() {
  console.log('Applying migration to update SQL functions...\n');
  
  // Try using raw SQL via the REST API
  const response1 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    },
    body: JSON.stringify({ sql: sql1 })
  });
  
  if (response1.ok) {
    console.log('✅ Updated consume_analyze_quota function');
  } else {
    console.log('⚠️  Could not update via API (status:', response1.status, ')');
    console.log('Please run this SQL manually in Supabase dashboard:');
    console.log(sql1);
    console.log(sql2);
  }
  
  process.exit(0);
}

apply();
