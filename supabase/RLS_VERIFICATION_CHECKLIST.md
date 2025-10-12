# RLS & Privileges Verification Checklist

## Migration Applied
✅ Run migration: `supabase/migrations/20250110_harden_rls_privileges.sql`

## Expected Security State

### 1. `stripe_events` — Server-only
- ✅ RLS enabled
- ✅ No policies (server-only access)
- ✅ `anon` role: NO privileges
- ✅ `authenticated` role: NO privileges
- ✅ `service_role` bypasses RLS (writes stripe webhook data)

### 2. `usage_events` — Server writes, clients read own
- ✅ RLS enabled
- ✅ Policy `usage_events_select_own`: SELECT where `user_id = auth.uid()`
- ✅ `anon` role: NO privileges
- ✅ `authenticated` role: SELECT only
- ✅ `service_role` bypasses RLS (writes usage audit logs)

### 3. `users` — Clients read/update own row
- ✅ RLS enabled
- ✅ Policy `users_select_own`: SELECT where `id = auth.uid()`
- ✅ Policy `users_update_own`: UPDATE where `id = auth.uid()`
- ✅ Policy `users_insert_own`: INSERT where `id = auth.uid()`
- ✅ `anon` role: NO privileges
- ✅ `authenticated` role: SELECT, UPDATE, INSERT
- ✅ No DELETE allowed for clients

### 4. `me_usage` view (optional)
- ✅ Returns aggregated usage scoped to `auth.uid()`
- ✅ `authenticated` role: SELECT only
- ✅ `anon` role: NO privileges

---

## Verification Tests

### Test 1: Run DB Linter
```bash
# If using Supabase CLI
supabase db lint

# Or manually check for:
# - RLS enabled on all public tables
# - No overly permissive policies (e.g., using (true))
# - No wildcard grants to anon/authenticated
```

### Test 2: Client can SELECT own usage_events ✓
```javascript
// Using Supabase JS client with authenticated user
const { data, error } = await supabase
  .from('usage_events')
  .select('*');

// Expected: Returns only rows where user_id = current user's auth.uid()
// Should NOT return other users' events
```

### Test 3: Client cannot see stripe_events ✗
```javascript
// Using Supabase JS client with authenticated user
const { data, error } = await supabase
  .from('stripe_events')
  .select('*');

// Expected: error !== null (permission denied or empty result set)
// Should return PGRST301 (insufficient privilege) or empty array with no rows
```

### Test 4: Client can only read/update own users row ✓
```javascript
// Using Supabase JS client with authenticated user
const userId = (await supabase.auth.getUser()).data.user.id;

// SELECT own row - SHOULD SUCCEED
const { data: ownRow } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();

// UPDATE own row - SHOULD SUCCEED
const { error: updateError } = await supabase
  .from('users')
  .update({ email: 'newemail@example.com' })
  .eq('id', userId);

// SELECT another user's row - SHOULD FAIL or return empty
const { data: otherRows } = await supabase
  .from('users')
  .select('*')
  .neq('id', userId);
// Expected: otherRows = [] (empty, RLS filtered)

// UPDATE another user's row - SHOULD FAIL
const otherUserId = '00000000-0000-0000-0000-000000000000';
const { error: forbiddenUpdate } = await supabase
  .from('users')
  .update({ tier: 'pro' })
  .eq('id', otherUserId);
// Expected: forbiddenUpdate !== null (0 rows affected or permission denied)
```

### Test 5: Server (service role) can write to all tables ✓
```javascript
// Using service_role key (backend only)
const { error: stripeError } = await supabaseAdmin
  .from('stripe_events')
  .insert({ event_id: 'evt_test', type: 'test', payload: {} });
// Expected: success (no error)

const { error: usageError } = await supabaseAdmin
  .from('usage_events')
  .insert({ user_id: someUserId, action: 'analyze', count: 1 });
// Expected: success (no error)

const { error: userError } = await supabaseAdmin
  .from('users')
  .update({ comments_analyzed_count: 5 })
  .eq('id', someUserId);
// Expected: success (no error)
```

---

## Manual SQL Verification

Run these queries in Supabase SQL Editor to confirm configuration:

### Check RLS is enabled
```sql
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('stripe_events', 'usage_events', 'users');
```

Expected output:
```
tablename       | rls_enabled
----------------|------------
stripe_events   | t
usage_events    | t
users           | t
```

### List all policies
```sql
SELECT
  tablename,
  policyname,
  cmd AS command,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('stripe_events', 'usage_events', 'users')
ORDER BY tablename, policyname;
```

Expected output:
```
tablename     | policyname              | command | roles
--------------|-------------------------|---------|----------------
usage_events  | usage_events_select_own | SELECT  | {authenticated}
users         | users_insert_own        | INSERT  | {authenticated}
users         | users_select_own        | SELECT  | {authenticated}
users         | users_update_own        | UPDATE  | {authenticated}
```

### Check privilege grants
```sql
SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('stripe_events', 'usage_events', 'users')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
```

Expected output:
```
table_name    | grantee       | privilege_type
--------------|---------------|---------------
usage_events  | authenticated | SELECT
users         | authenticated | INSERT
users         | authenticated | SELECT
users         | authenticated | UPDATE
```

*(Note: `stripe_events` should have NO rows for anon/authenticated)*

---

## Rollback (if needed)

To revert this migration:

```sql
-- Remove policies
DROP POLICY IF EXISTS "usage_events_select_own" ON public.usage_events;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;

-- Remove view
DROP VIEW IF EXISTS public.me_usage;

-- Optionally re-grant privileges (original state: service-role only)
REVOKE ALL ON public.stripe_events FROM anon, authenticated;
REVOKE ALL ON public.usage_events FROM anon, authenticated;
REVOKE ALL ON public.users FROM anon, authenticated;
```

---

## Post-Migration Smoke Test Summary

Run through these quickly after applying migration:

1. ✅ **Run DB Linter** — Check for security issues
2. ✅ **(a) Client SELECT own usage_events ok** — Authenticated user sees their events
3. ✅ **(b) Client can't see stripe_events** — Permission denied or empty result
4. ✅ **(c) Client can only read/update own users row** — Other rows filtered by RLS
5. ✅ **(d) Server (service_role) still writes usage_events + stripe_events** — Backend operations succeed

---

## Notes

- **Service role bypasses RLS**: Backend code using `SUPABASE_SERVICE_ROLE_KEY` has full access to all tables
- **Client libraries use anon or authenticated role**: User-facing Supabase clients are restricted by RLS policies
- **No DELETE policies**: Clients cannot delete from any of these tables
- **INSERT policy on users**: Allows self-registration pattern where client provides `id = auth.uid()`
- **Default id generation**: If client doesn't provide `id`, `gen_random_uuid()` default will fail RLS check unless modified

---

**Migration File**: `supabase/migrations/20250110_harden_rls_privileges.sql`
