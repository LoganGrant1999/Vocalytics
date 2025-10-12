-- ============================================================
-- RLS Verification Query Suite
-- Run this in Supabase SQL Editor after applying migration
-- ============================================================

-- ============================================================
-- 1. Check RLS is enabled on all three tables
-- ============================================================

SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('stripe_events', 'usage_events', 'users')
ORDER BY tablename;

-- Expected: All three tables show rls_enabled = t (true)

-- ============================================================
-- 2. List all RLS policies
-- ============================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS command,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('stripe_events', 'usage_events', 'users')
ORDER BY tablename, policyname;

-- Expected policies:
-- stripe_events: NONE (server-only, no client policies)
-- usage_events: usage_events_select_own (SELECT, authenticated)
-- users: users_select_own, users_update_own, users_insert_own (authenticated)

-- ============================================================
-- 3. Check privilege grants for anon and authenticated roles
-- ============================================================

SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('stripe_events', 'usage_events', 'users')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- Expected grants:
-- stripe_events: NONE for anon/authenticated
-- usage_events: SELECT for authenticated only
-- users: SELECT, UPDATE, INSERT for authenticated only

-- ============================================================
-- 4. Check view grants (me_usage)
-- ============================================================

SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'me_usage'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- Expected: SELECT for authenticated, NONE for anon

-- ============================================================
-- 5. Verify policy expressions (detailed)
-- ============================================================

SELECT
  tablename,
  policyname,
  cmd,
  roles,
  CASE
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    ELSE 'USING: (none)'
  END AS using_clause,
  CASE
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE 'WITH CHECK: (none)'
  END AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('stripe_events', 'usage_events', 'users')
ORDER BY tablename, policyname;

-- Expected:
-- usage_events_select_own: USING (user_id = auth.uid())
-- users_select_own: USING (id = auth.uid())
-- users_update_own: USING (id = auth.uid()) WITH CHECK (id = auth.uid())
-- users_insert_own: WITH CHECK (id = auth.uid())

-- ============================================================
-- 6. Count existing rows (as service_role)
-- ============================================================

SELECT
  'stripe_events' AS table_name,
  COUNT(*) AS row_count
FROM public.stripe_events
UNION ALL
SELECT
  'usage_events' AS table_name,
  COUNT(*) AS row_count
FROM public.usage_events
UNION ALL
SELECT
  'users' AS table_name,
  COUNT(*) AS row_count
FROM public.users;

-- This query runs as service_role (bypasses RLS)
-- Shows total row counts for each table

-- ============================================================
-- 7. Test auth.uid() function availability
-- ============================================================

SELECT
  current_user AS postgres_role,
  auth.uid() AS auth_user_id,
  CASE
    WHEN auth.uid() IS NULL THEN 'No authenticated user (expected in SQL Editor)'
    ELSE 'Authenticated as: ' || auth.uid()::text
  END AS auth_status;

-- Note: In Supabase SQL Editor, auth.uid() returns NULL
-- because you're running as service_role, not as an authenticated client

-- ============================================================
-- SUMMARY OF EXPECTED RESULTS
-- ============================================================

-- Query 1: All tables have RLS enabled (rls_enabled = t)
-- Query 2: Policies exist for usage_events and users; none for stripe_events
-- Query 3: authenticated has SELECT on usage_events; SELECT/UPDATE/INSERT on users
-- Query 4: authenticated has SELECT on me_usage view
-- Query 5: Policy expressions match auth.uid() scoping
-- Query 6: Shows total row counts (visible only to service_role)
-- Query 7: Shows current role and auth context

-- ============================================================
-- DONE
-- ============================================================

-- If all queries return expected results, RLS is properly configured.
-- Proceed to client-side testing with Supabase JS client to verify
-- that authenticated users can only access their own data.
