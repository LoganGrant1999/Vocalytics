#!/bin/bash
# Run Supabase migrations for local development

set -e

# Load environment variables from packages/server/.env.local
if [ -f packages/server/.env.local ]; then
  export $(grep -v '^#' packages/server/.env.local | xargs)
fi

# Check if SUPABASE_URL is set
if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" = "https://YOUR-PROJECT.supabase.co" ]; then
  echo "❌ Error: SUPABASE_URL is not set or is a placeholder"
  echo "Please update packages/server/.env.local with your real Supabase credentials"
  exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed 's|https://||' | cut -d'.' -f1)
DB_HOST="db.${PROJECT_REF}.supabase.co"

echo "🔄 Running migrations..."
echo "   Host: $DB_HOST"
echo ""

# Run each migration in order
for migration in supabase/migrations/*.sql; do
  echo "📝 Running: $(basename $migration)"
  PGPASSWORD="$SUPABASE_SERVICE_ROLE_KEY" psql \
    -h "$DB_HOST" \
    -p 5432 \
    -U postgres \
    -d postgres \
    -f "$migration" \
    -v ON_ERROR_STOP=1

  if [ $? -eq 0 ]; then
    echo "   ✅ Success"
  else
    echo "   ❌ Failed"
    exit 1
  fi
  echo ""
done

echo "✅ All migrations completed successfully!"
