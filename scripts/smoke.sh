#!/usr/bin/env bash

################################################################################
# Vocalytics HTTP API Smoke Test
# Production-style validation of auth, metering, paywall, Stripe, and pro bypass
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
EXPECT_ANALYZE_CAP="${EXPECT_ANALYZE_CAP:-2}"
EXPECT_REPLY_CAP="${EXPECT_REPLY_CAP:-1}"

# Required environment variables
REQUIRED_VARS=("SUPABASE_URL" "SUPABASE_ANON" "TEST_EMAIL" "TEST_PASS")

# Global variables for test state
JWT=""
LAST_RESPONSE=""
LAST_STATUS=""
STRIPE_CHECKOUT_URL=""

################################################################################
# Helper Functions
################################################################################

log_section() {
  echo ""
  echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
}

log_info() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_step() {
  echo ""
  echo -e "${YELLOW}→${NC} $1"
}

check_dependencies() {
  local missing=()

  for cmd in curl jq node; do
    if ! command -v "$cmd" &> /dev/null; then
      missing+=("$cmd")
    fi
  done

  if [ ${#missing[@]} -ne 0 ]; then
    log_error "Missing required tools: ${missing[*]}"
    echo "  Install with: brew install curl jq node (macOS) or apt-get install curl jq nodejs (Linux)"
    exit 1
  fi
}

check_env() {
  local missing=()

  for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
      missing+=("$var")
    fi
  done

  if [ ${#missing[@]} -ne 0 ]; then
    log_error "Missing required environment variables: ${missing[*]}"
    echo ""
    echo "Set them like:"
    echo "  export SUPABASE_URL=https://xxx.supabase.co"
    echo "  export SUPABASE_ANON=eyJhbGc..."
    echo "  export TEST_EMAIL=test@example.com"
    echo "  export TEST_PASS=password123"
    echo ""
    echo "Then run: bash scripts/smoke.sh"
    exit 1
  fi
}

make_request() {
  local method="$1"
  local path="$2"
  local auth_header="${3:-}"
  local data="${4:-}"

  local curl_cmd=(curl -s -w "\n%{http_code}" -X "$method" "${BASE_URL}${path}")

  if [ -n "$auth_header" ]; then
    curl_cmd+=(-H "Authorization: Bearer $auth_header")
  fi

  if [ -n "$data" ]; then
    curl_cmd+=(-H "Content-Type: application/json" -d "$data")
  fi

  local response
  response=$("${curl_cmd[@]}")

  # Split response body and status code
  LAST_STATUS=$(echo "$response" | tail -n1)
  LAST_RESPONSE=$(echo "$response" | sed '$d')
}

expect_status() {
  local expected="$1"
  local message="${2:-Expected HTTP $expected}"

  if [ "$LAST_STATUS" != "$expected" ]; then
    log_error "$message"
    log_error "Got HTTP $LAST_STATUS instead"
    echo "Response body:"
    echo "$LAST_RESPONSE" | jq '.' 2>/dev/null || echo "$LAST_RESPONSE"
    exit 1
  fi

  log_info "$message (got $LAST_STATUS)"
}

expect_json_field() {
  local jq_filter="$1"
  local expected="$2"
  local message="${3:-Expected $jq_filter=$expected}"

  local actual
  actual=$(echo "$LAST_RESPONSE" | jq -r "$jq_filter" 2>/dev/null || echo "")

  if [ "$actual" != "$expected" ]; then
    log_error "$message"
    log_error "Got: $actual"
    echo "Response body:"
    echo "$LAST_RESPONSE" | jq '.' 2>/dev/null || echo "$LAST_RESPONSE"
    exit 1
  fi

  log_info "$message"
}

expect_json_exists() {
  local jq_filter="$1"
  local message="${2:-Expected field $jq_filter to exist}"

  local result
  result=$(echo "$LAST_RESPONSE" | jq -e "$jq_filter" &>/dev/null && echo "exists" || echo "missing")

  if [ "$result" = "missing" ]; then
    log_error "$message"
    echo "Response body:"
    echo "$LAST_RESPONSE" | jq '.' 2>/dev/null || echo "$LAST_RESPONSE"
    exit 1
  fi

  log_info "$message"
}

get_json_field() {
  local jq_filter="$1"
  echo "$LAST_RESPONSE" | jq -r "$jq_filter"
}

################################################################################
# Test Execution
################################################################################

main() {
  log_section "Vocalytics HTTP API Smoke Test"

  echo "Configuration:"
  echo "  BASE_URL: $BASE_URL"
  echo "  SUPABASE_URL: $SUPABASE_URL"
  echo "  TEST_EMAIL: $TEST_EMAIL"
  echo "  EXPECT_ANALYZE_CAP: $EXPECT_ANALYZE_CAP"
  echo "  EXPECT_REPLY_CAP: $EXPECT_REPLY_CAP"

  log_step "Checking dependencies..."
  check_dependencies
  log_info "All required tools found"

  log_step "Checking environment variables..."
  check_env
  log_info "All required environment variables set"

  # ============================================================================
  # 1. Health Check
  # ============================================================================
  log_section "1. Health Check"

  make_request GET "/healthz"
  expect_status 200 "Health check passed"
  expect_json_field ".status" "ok" "Service status is ok"

  # ============================================================================
  # 2. Security - No Auth (expect 401)
  # ============================================================================
  log_section "2. Security - Missing Auth Token"

  make_request GET "/api/me/subscription"
  expect_status 401 "Request without auth rejected"

  # ============================================================================
  # 3. Get JWT Token
  # ============================================================================
  log_section "3. Authentication - Get JWT"

  log_step "Obtaining JWT token via Supabase auth..."
  if ! JWT=$(SUPABASE_URL="$SUPABASE_URL" SUPABASE_ANON="$SUPABASE_ANON" TEST_EMAIL="$TEST_EMAIL" TEST_PASS="$TEST_PASS" node scripts/get-jwt.js 2>&1); then
    log_error "Failed to get JWT token"
    echo "$JWT"
    exit 1
  fi

  log_info "JWT token obtained (${#JWT} chars)"

  # ============================================================================
  # 4. Subscription Baseline
  # ============================================================================
  log_section "4. Subscription Baseline"

  make_request GET "/api/me/subscription" "$JWT"
  expect_status 200 "Subscription endpoint accessible"
  expect_json_field ".tier" "free" "User tier is free"

  # ============================================================================
  # 5. Analyze Metering - Test Free Tier Cap
  # ============================================================================
  log_section "5. Analyze Comments - Free Tier Metering"

  log_step "Analyzing comments (1/$EXPECT_ANALYZE_CAP)..."
  make_request POST "/api/analyze-comments" "$JWT" '{
    "comments": [
      {
        "id": "test1",
        "videoId": "vid1",
        "author": "Alice",
        "text": "Great video!",
        "publishedAt": "2025-10-10T12:00:00Z",
        "likeCount": 5,
        "replyCount": 0,
        "isReply": false
      }
    ]
  }'
  expect_status 200 "First analyze request succeeded"

  log_step "Analyzing comments (2/$EXPECT_ANALYZE_CAP)..."
  make_request POST "/api/analyze-comments" "$JWT" '{
    "comments": [
      {
        "id": "test2",
        "videoId": "vid1",
        "author": "Bob",
        "text": "Thanks for sharing!",
        "publishedAt": "2025-10-10T12:01:00Z",
        "likeCount": 3,
        "replyCount": 0,
        "isReply": false
      }
    ]
  }'
  expect_status 200 "Second analyze request succeeded"

  log_step "Analyzing comments ($((EXPECT_ANALYZE_CAP + 1))/$EXPECT_ANALYZE_CAP - should hit paywall)..."
  make_request POST "/api/analyze-comments" "$JWT" '{
    "comments": [
      {
        "id": "test3",
        "videoId": "vid1",
        "author": "Charlie",
        "text": "Interesting!",
        "publishedAt": "2025-10-10T12:02:00Z",
        "likeCount": 1,
        "replyCount": 0,
        "isReply": false
      }
    ]
  }'
  expect_status 402 "Paywall enforced on analyze"
  expect_json_field ".code" "PAYWALL" "Paywall code is PAYWALL"
  expect_json_field ".reason" "FREE_TIER_EXCEEDED" "Paywall reason is FREE_TIER_EXCEEDED"
  expect_json_field ".feature" "analyze" "Paywall feature is analyze"
  expect_json_exists ".upgradeUrl" "Paywall includes upgradeUrl"
  expect_json_exists ".manageUrl" "Paywall includes manageUrl"

  # ============================================================================
  # 6. Reply Metering - Test Daily Cap
  # ============================================================================
  log_section "6. Generate Replies - Daily Metering"

  log_step "Generating reply (1/$EXPECT_REPLY_CAP)..."
  make_request POST "/api/generate-replies" "$JWT" '{
    "comment": {
      "id": "reply_test1",
      "videoId": "vid1",
      "author": "Alice",
      "text": "Love this!",
      "publishedAt": "2025-10-10T12:00:00Z",
      "likeCount": 10,
      "replyCount": 0,
      "isReply": false
    },
    "tones": ["friendly"]
  }'
  expect_status 200 "First reply generation succeeded"

  log_step "Generating reply ($((EXPECT_REPLY_CAP + 1))/$EXPECT_REPLY_CAP - should hit paywall)..."
  make_request POST "/api/generate-replies" "$JWT" '{
    "comment": {
      "id": "reply_test2",
      "videoId": "vid1",
      "author": "Bob",
      "text": "Amazing content!",
      "publishedAt": "2025-10-10T12:01:00Z",
      "likeCount": 8,
      "replyCount": 0,
      "isReply": false
    },
    "tones": ["enthusiastic"]
  }'
  expect_status 402 "Paywall enforced on reply"
  expect_json_field ".code" "PAYWALL" "Paywall code is PAYWALL"
  expect_json_field ".feature" "reply" "Paywall feature is reply"

  # ============================================================================
  # 7. Usage Endpoint Validation
  # ============================================================================
  log_section "7. Usage Endpoint Validation"

  make_request GET "/api/me/usage" "$JWT"
  expect_status 200 "Usage endpoint accessible"
  expect_json_field ".commentsAnalyzed" "$EXPECT_ANALYZE_CAP" "Comments analyzed count matches cap"
  expect_json_field ".repliesGenerated" "$EXPECT_REPLY_CAP" "Replies generated count matches cap"
  expect_json_field ".limits.weeklyAnalyze" "$EXPECT_ANALYZE_CAP" "Weekly analyze limit correct"
  expect_json_field ".limits.dailyReply" "$EXPECT_REPLY_CAP" "Daily reply limit correct"

  # ============================================================================
  # 8. Stripe Checkout
  # ============================================================================
  log_section "8. Stripe Checkout Session"

  log_step "Creating Stripe checkout session..."
  make_request POST "/api/billing/checkout" "$JWT"
  expect_status 200 "Checkout session created"
  expect_json_exists ".url" "Checkout URL returned"

  STRIPE_CHECKOUT_URL=$(get_json_field ".url")
  log_info "Checkout URL: $STRIPE_CHECKOUT_URL"

  log_warn "MANUAL STEP REQUIRED:"
  echo "  1. Start Stripe webhook forwarding:"
  echo "     stripe listen --forward-to ${BASE_URL}/api/webhook/stripe"
  echo ""
  echo "  2. Open checkout URL and complete payment with test card:"
  echo "     Card: 4242 4242 4242 4242"
  echo "     Expiry: any future date"
  echo "     CVC: any 3 digits"
  echo "     URL: $STRIPE_CHECKOUT_URL"
  echo ""
  echo "  3. Wait for webhook to process subscription"
  echo ""
  read -p "Press Enter after completing checkout and seeing webhook event processed..." -r

  # ============================================================================
  # 9. Verify Subscription Active
  # ============================================================================
  log_section "9. Verify Pro Subscription Active"

  log_step "Checking subscription status..."
  MAX_RETRIES=10
  RETRY_DELAY=2

  for i in $(seq 1 $MAX_RETRIES); do
    make_request GET "/api/me/subscription" "$JWT"

    SUBSCRIPTION_STATUS=$(get_json_field ".subscription_status")

    if [ "$SUBSCRIPTION_STATUS" = "active" ]; then
      log_info "Subscription is active"
      expect_json_field ".tier" "pro" "User tier upgraded to pro"
      expect_json_exists ".stripe_customer_id" "Stripe customer ID set"
      expect_json_exists ".stripe_subscription_id" "Stripe subscription ID set"
      break
    else
      log_warn "Subscription not active yet (attempt $i/$MAX_RETRIES), waiting ${RETRY_DELAY}s..."
      sleep $RETRY_DELAY
    fi

    if [ "$i" -eq "$MAX_RETRIES" ]; then
      log_error "Subscription did not become active after $MAX_RETRIES attempts"
      echo "Current status: $SUBSCRIPTION_STATUS"
      echo "Check:"
      echo "  - Stripe CLI is running and forwarding webhooks"
      echo "  - STRIPE_WEBHOOK_SECRET is set correctly in server .env"
      echo "  - Webhook events are being received (check server logs)"
      exit 1
    fi
  done

  # ============================================================================
  # 10. Pro Bypass - No Paywall
  # ============================================================================
  log_section "10. Pro User - Paywall Bypass"

  log_step "Analyzing comments as Pro user (should bypass paywall)..."
  make_request POST "/api/analyze-comments" "$JWT" '{
    "comments": [
      {
        "id": "pro_test1",
        "videoId": "vid1",
        "author": "ProUser",
        "text": "Testing pro bypass",
        "publishedAt": "2025-10-10T13:00:00Z",
        "likeCount": 1,
        "replyCount": 0,
        "isReply": false
      }
    ]
  }'
  expect_status 200 "Pro user can analyze without paywall"

  log_step "Checking usage (pro users may not increment counters)..."
  make_request GET "/api/me/usage" "$JWT"
  CURRENT_ANALYZED=$(get_json_field ".commentsAnalyzed")

  if [ "$CURRENT_ANALYZED" -eq "$EXPECT_ANALYZE_CAP" ]; then
    log_info "Pro user usage not counted (still at $CURRENT_ANALYZED)"
  else
    log_warn "Pro user usage was counted (now at $CURRENT_ANALYZED)"
    log_warn "This is acceptable - implementation may choose to count or not count pro usage"
  fi

  # ============================================================================
  # 11. Billing Portal
  # ============================================================================
  log_section "11. Billing Portal Session"

  log_step "Creating billing portal session..."
  make_request POST "/api/billing/portal" "$JWT"
  expect_status 200 "Portal session created"
  expect_json_exists ".url" "Portal URL returned"

  PORTAL_URL=$(get_json_field ".url")
  log_info "Portal URL: $PORTAL_URL"

  if [[ "$PORTAL_URL" =~ ^https:// ]]; then
    log_info "Portal URL is HTTPS"
  else
    log_warn "Portal URL is not HTTPS: $PORTAL_URL"
  fi

  # ============================================================================
  # 12. Security Edge Cases
  # ============================================================================
  log_section "12. Security - Bad Token"

  make_request GET "/api/me/subscription" "invalid_token_12345"
  expect_status 401 "Bad token rejected"

  # ============================================================================
  # 13. Reset Simulation (Manual)
  # ============================================================================
  log_section "13. Usage Reset Simulation (Manual)"

  log_warn "INFORMATIONAL - Manual Reset Procedures"
  echo ""
  echo "To reset counters manually (simulating cron jobs):"
  echo ""
  echo "1. Go to Supabase Dashboard > SQL Editor"
  echo ""
  echo "2. Reset daily reply counters (normally runs 00:00 UTC daily):"
  echo "   CALL public.reset_daily_replies();"
  echo ""
  echo "3. Reset weekly comment counters (normally runs Mon 00:00 UTC):"
  echo "   CALL public.reset_weekly_comments();"
  echo ""
  echo "4. Verify reset:"
  echo "   curl -H \"Authorization: Bearer \$JWT\" ${BASE_URL}/api/me/usage"
  echo ""
  echo "Expected: commentsAnalyzed=0, repliesGenerated=0"
  echo ""

  # ============================================================================
  # Summary
  # ============================================================================
  log_section "✅ All Smoke Tests Passed!"

  echo ""
  echo "Summary:"
  echo "  ✓ Health check"
  echo "  ✓ Authentication & authorization"
  echo "  ✓ Free tier metering (analyze: $EXPECT_ANALYZE_CAP, reply: $EXPECT_REPLY_CAP)"
  echo "  ✓ Paywall enforcement (HTTP 402)"
  echo "  ✓ Usage tracking"
  echo "  ✓ Stripe checkout"
  echo "  ✓ Subscription activation"
  echo "  ✓ Pro tier bypass"
  echo "  ✓ Billing portal"
  echo "  ✓ Security (401 on bad auth)"
  echo ""
  echo "Checkout URL: $STRIPE_CHECKOUT_URL"
  echo "Portal URL: $PORTAL_URL"
  echo ""
}

# Run main function
main "$@"
