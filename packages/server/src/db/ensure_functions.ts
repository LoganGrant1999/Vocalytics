import { supabase } from './client.js';

const CONSUME_ANALYZE_SQL = `
create or replace function public.consume_analyze_quota(_user_id uuid, _cap int)
returns table(allowed boolean, new_count int)
language sql
security definer
set search_path = public
as $$
  update public.users
     set comments_analyzed_count = comments_analyzed_count + 1
   where id = _user_id
     and comments_analyzed_count < _cap
   returning true as allowed, comments_analyzed_count as new_count
$$;
`;

const CONSUME_REPLY_SQL = `
create or replace function public.consume_reply_quota(_user_id uuid, _cap int)
returns table(allowed boolean, new_count int)
language sql
security definer
set search_path = public
as $$
  update public.users
     set replies_generated_count = replies_generated_count + 1
   where id = _user_id
     and replies_generated_count < _cap
   returning true as allowed, replies_generated_count as new_count
$$;
`;

const GRANT_ANALYZE = `grant execute on function public.consume_analyze_quota(uuid, int) to authenticated;`;
const GRANT_REPLY = `grant execute on function public.consume_reply_quota(uuid, int) to authenticated;`;

export async function ensureQuotaFunctionsExist() {
  console.log('[DB] Ensuring quota functions exist...');

  try {
    // Test if functions exist by trying to call them
    const testUserId = '00000000-0000-0000-0000-000000000000';
    await supabase.rpc('consume_analyze_quota', {
      _user_id: testUserId,
      _cap: 1
    });

    console.log('[DB] ✓ Quota functions already exist');
    return true;
  } catch (error: any) {
    console.log('[DB] Functions need to be created');
    console.log('[DB] Please run this SQL in your Supabase SQL Editor:');
    console.log('\n---BEGIN SQL---');
    console.log(CONSUME_ANALYZE_SQL);
    console.log(CONSUME_REPLY_SQL);
    console.log(GRANT_ANALYZE);
    console.log(GRANT_REPLY);
    console.log('---END SQL---\n');

    throw new Error('Database functions not found. Please apply the migration SQL above.');
  }
}
