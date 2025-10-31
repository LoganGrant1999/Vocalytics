#!/bin/bash
# Test cron endpoints locally or on deployed environment

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

CRON_SECRET=${CRON_SECRET:-"test-secret"}
BASE_URL=${1:-"http://localhost:3000"}

echo "🧪 Testing Cron Endpoints"
echo "=========================="
echo "Base URL: $BASE_URL"
echo ""

# Test Queue Worker
echo "📦 Testing Queue Worker..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/cron/queue-worker" \
  -H "Authorization: Bearer $CRON_SECRET")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Queue Worker: SUCCESS"
  echo "   Response: $BODY"
else
  echo "❌ Queue Worker: FAILED (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
fi

echo ""

# Test Counter Reset
echo "🔄 Testing Counter Reset..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/cron/reset-counters" \
  -H "Authorization: Bearer $CRON_SECRET")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Counter Reset: SUCCESS"
  echo "   Response: $BODY"
else
  echo "❌ Counter Reset: FAILED (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
fi

echo ""
echo "=========================="
echo "✅ Cron tests complete"
echo ""
echo "To test on production:"
echo "  ./scripts/test-crons.sh https://your-app.vercel.app"
