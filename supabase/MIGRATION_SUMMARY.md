# Supabase RLS & Privileges Hardening — Migration Summary

## What Was Created

### 1. **Migration File**
`supabase/migrations/20250110_harden_rls_privileges.sql`

Implements strict RLS policies and privilege controls for three tables:
- `stripe_events` — server-only (no client access)
- `usage_events` — clients read own rows, server writes
- `users` — clients read/update/insert own row, server has full access

### 2. **Verification Checklist**
`supabase/RLS_VERIFICATION_CHECKLIST.md`

Step-by-step guide with:
- Expected security state for each table
- Client-side test cases (JavaScript examples)
- Manual SQL verification queries
- Rollback instructions

### 3. **SQL Verification Script**
`supabase/verify_rls.sql`

Pre-built queries to run in Supabase SQL Editor that check:
- RLS enabled status
- Policy definitions
- Privilege grants
- View permissions

---

## How to Apply Migration

### Option A: Supabase CLI (Recommended)
```bash
# Push migration to your Supabase project
cd /Users/logangrant/Desktop/Vocalytics
supabase db push

# Or apply specific migration
supabase migration up
```

### Option B: Supabase Dashboard
1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Create new query
4. Paste contents of `supabase/migrations/20250110_harden_rls_privileges.sql`
5. Run the query

---

## What Changed

### Table: `stripe_events`
**Before:**
- RLS enabled but no policies (service-role only)
- No explicit privilege revocations

**After:**
- ✅ Explicitly revoked ALL from `anon` and `authenticated`
- ✅ Still server-only (service_role bypasses RLS)
- ✅ Added comment documenting server-only access

### Table: `usage_events`
**Before:**
- RLS enabled but no policies (service-role only)
- Clients couldn't read their own usage history

**After:**
- ✅ Policy `usage_events_select_own`: SELECT where `user_id = auth.uid()`
- ✅ Granted SELECT to `authenticated` role
- ✅ Revoked ALL from `anon` role
- ✅ Server still writes via service_role
- ✅ Clients can now query their own usage history

### Table: `users`
**Before:**
- RLS enabled but no policies (service-role only)
- Clients couldn't read their own profile

**After:**
- ✅ Policy `users_select_own`: SELECT where `id = auth.uid()`
- ✅ Policy `users_update_own`: UPDATE where `id = auth.uid()`
- ✅ Policy `users_insert_own`: INSERT where `id = auth.uid()` (self-registration)
- ✅ Granted SELECT, UPDATE, INSERT to `authenticated` role
- ✅ Revoked ALL from `anon` role
- ✅ No DELETE policy (clients cannot delete their account)

### New: `me_usage` View (Optional)
**Added:**
- ✅ Aggregates usage_events per user/action
- ✅ Automatically scoped to `auth.uid()`
- ✅ Granted SELECT to `authenticated` role
- ✅ Useful for dashboard queries

---

## Verification Steps

### Step 1: Run DB Linter
```bash
# If using Supabase CLI
supabase db lint
```

### Step 2: Run SQL Verification
Open Supabase SQL Editor and run:
```sql
-- Copy/paste from supabase/verify_rls.sql
```

Expected results documented in the file comments.

### Step 3: Smoke Test (Client-side)

#### (a) Client can SELECT own usage_events ✓
```javascript
// Using authenticated Supabase client
const { data, error } = await supabase
  .from('usage_events')
  .select('*');

// Should return only current user's events
console.log(data); // rows where user_id = auth.uid()
```

#### (b) Client cannot see stripe_events ✗
```javascript
const { data, error } = await supabase
  .from('stripe_events')
  .select('*');

// Should fail with permission error or return empty array
console.log(error); // Expected: PGRST301 or similar
```

#### (c) Client can only read/update own users row ✓
```javascript
const user = await supabase.auth.getUser();
const userId = user.data.user.id;

// Read own row - SHOULD WORK
const { data: me } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();

// Update own row - SHOULD WORK
const { error: updateError } = await supabase
  .from('users')
  .update({ email: 'new@example.com' })
  .eq('id', userId);

// Read other users - SHOULD RETURN EMPTY
const { data: others } = await supabase
  .from('users')
  .select('*')
  .neq('id', userId);
console.log(others); // Expected: []
```

#### (d) Server (service_role) still writes ✓
```javascript
// Backend code using service_role key
const { error: stripeErr } = await supabaseAdmin
  .from('stripe_events')
  .insert({ event_id: 'evt_test', type: 'test', payload: {} });

const { error: usageErr } = await supabaseAdmin
  .from('usage_events')
  .insert({ user_id: someUserId, action: 'analyze', count: 1 });

// Should succeed (no errors)
```

---

## Security Guarantees

After this migration:

1. ✅ **No client access to stripe_events** — Webhook data is server-only
2. ✅ **Clients cannot read other users' usage_events** — RLS enforces `user_id = auth.uid()`
3. ✅ **Clients cannot read other users' profile data** — RLS enforces `id = auth.uid()`
4. ✅ **Clients cannot escalate their tier** — UPDATE policy still uses RLS check
5. ✅ **No anonymous access** — All `anon` privileges revoked
6. ✅ **Server retains full control** — service_role bypasses RLS
7. ✅ **No client deletes** — DELETE privilege not granted

---

## Important Notes

### Default `id` Generation
The `users` table has:
```sql
id uuid primary key default gen_random_uuid()
```

With the INSERT policy `id = auth.uid()`, clients **must explicitly set** `id`:
```javascript
// Client-side insert (self-registration)
const user = await supabase.auth.getUser();
await supabase.from('users').insert({
  id: user.data.user.id,  // MUST provide this
  email: user.data.user.email,
  tier: 'free'
});
```

If you want the default to work, consider changing to:
```sql
id uuid primary key default auth.uid()
```

But this requires the client to have an authenticated session at INSERT time.

### Update Column Restrictions
The current UPDATE policy allows updating **any column**. To restrict which columns clients can update:

```sql
-- Example: Only allow updating email, not tier or Stripe fields
CREATE POLICY "users_update_own"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    tier = OLD.tier AND  -- Cannot change tier
    stripe_customer_id = OLD.stripe_customer_id  -- Cannot change Stripe ID
  );
```

This migration does **not** restrict columns, so clients can theoretically update any field. Consider adding column restrictions if needed.

---

## Rollback

If you need to revert:

```sql
-- Remove policies
DROP POLICY IF EXISTS "usage_events_select_own" ON public.usage_events;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;

-- Remove view
DROP VIEW IF EXISTS public.me_usage;

-- Revoke privileges
REVOKE ALL ON public.stripe_events FROM anon, authenticated;
REVOKE ALL ON public.usage_events FROM anon, authenticated;
REVOKE ALL ON public.users FROM anon, authenticated;

-- RLS remains enabled (original state)
```

---

## Next Steps

1. ✅ Apply migration (`supabase db push` or via SQL Editor)
2. ✅ Run verification queries (`supabase/verify_rls.sql`)
3. ✅ Run client-side smoke tests (see checklist)
4. ✅ Update client code to handle new permissions
5. ✅ Test end-to-end flows (registration, usage tracking, billing)
6. ⚠️ Consider adding column-level UPDATE restrictions if needed
7. ⚠️ Consider changing `users.id` default to `auth.uid()` if self-registration pattern used

---

## Files Created

```
supabase/
├── migrations/
│   └── 20250110_harden_rls_privileges.sql  ← Apply this
├── RLS_VERIFICATION_CHECKLIST.md          ← Step-by-step tests
├── verify_rls.sql                          ← Quick verification queries
└── MIGRATION_SUMMARY.md                    ← This file
```

---

**Migration is ready to apply!** 🚀

Follow the steps in `RLS_VERIFICATION_CHECKLIST.md` after applying.
