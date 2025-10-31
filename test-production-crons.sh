#!/bin/bash
# Test production cron endpoints

CRON_SECRET="e1f6706b9c7082786418bffa9ab811d450e082e0e49da2cbf8b6637e37f9d1be"
BASE_URL="https://vocalytics-alpha.vercel.app"

echo "🧪 Testing Production Cron Endpoints"
echo "===================================="
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
echo "===================================="
echo "✅ Cron endpoint tests complete"
