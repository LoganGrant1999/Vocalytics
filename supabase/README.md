# Vocalytics Supabase Schema

This file mirrors the production database schema. It exists for:
- Source control and versioning
- Onboarding new developers
- CI/CD drift detection
- Local development setup

## Applying the Schema

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `schema.sql`
4. Paste and run the SQL

### Option 2: psql Command Line
```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" -f supabase/schema.sql
```

## Important Notes

- **Production already matches this schema** - this file is for tracking and reference
- We intentionally rely on service-role RLS bypass on the server
- All database operations go through the service-role key, not user-level auth
- The schema includes automated cron jobs for resetting free-tier usage counters

## Schema Overview

### Tables
- `public.users` - User accounts, tier, usage counters, and Stripe linkage
- `public.usage_events` - Audit log for usage tracking (optional analytics)
- `public.stripe_events` - Webhook event storage for idempotency

### Automated Jobs
- **Daily (00:00 UTC)**: Reset `replies_generated_count` for free-tier users
- **Weekly (Mon 00:00 UTC)**: Reset `comments_analyzed_count` for free-tier users

### Security
- All tables have RLS enabled
- Service-role key bypasses RLS (used by backend)
- No public policies are defined
