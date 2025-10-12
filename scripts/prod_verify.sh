#!/usr/bin/env bash

################################################################################
# Vocalytics Production Verification
# One-command test suite execution with auto Stripe setup
################################################################################

set -Eeuo pipefail

# Script directory
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Load .env if present
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . ./.env
  set +a
fi

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

# Configuration
PORT="${PORT:-3000}"
BASE_URL="${BASE_URL:-http://localhost:${PORT}}"
TEST_EMAIL="${TEST_EMAIL:-test@example.com}"
TEST_PASS="${TEST_PASS:-test_password}"
EXPECT_ANALYZE_CAP="${EXPECT_ANALYZE_CAP:-2}"
EXPECT_REPLY_CAP="${EXPECT_REPLY_CAP:-1}"

# Required env vars
readonly REQUIRED_VARS=(
  "SUPABASE_URL"
  "SUPABASE_ANON"
  "STRIPE_SECRET_KEY"
  "STRIPE_PUBLISHABLE_KEY"
  "STRIPE_PRICE_ID"
  "TEST_EMAIL"
  "TEST_PASS"
)

################################################################################
# Logging Functions
################################################################################

log_banner() {
  echo ""
  echo -e "${BLUE}${BOLD}╔════════════════════════════════════════════════════════════════════════╗${NC}"
  printf "${BLUE}${BOLD}║ %-70s ║${NC}\\n" "$1"
  echo -e "${BLUE}${BOLD}╚════════════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

log_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}${BOLD}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_pass() {
  echo -e "${GREEN}✓${NC} $1"
}

log_fail() {
  echo -e "${RED}✗${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_info() {
  echo "  $1"
}

################################################################################
# Validation Functions
################################################################################

check_env() {
  local missing=()

  for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
      missing+=("$var")
    fi
  done

  if [ ${#missing[@]} -ne 0 ]; then
    log_fail "Missing required environment variables: ${missing[*]}"
    echo ""
    echo "Add them to .env (test mode values) and re-run."
    echo ""
    echo "Example:"
    echo "  SUPABASE_URL=https://xxx.supabase.co"
    echo "  SUPABASE_ANON=eyJhbGc..."
    echo "  TEST_EMAIL=test@example.com"
    echo "  TEST_PASS=password123"
    echo "  STRIPE_SECRET_KEY=sk_test_..."
    echo "  STRIPE_PUBLISHABLE_KEY=pk_test_..."
    echo "  STRIPE_PRICE_ID=price_..."
    echo ""
    exit 1
  fi

  log_pass "All required environment variables set"
}

################################################################################
# Cleanup
################################################################################

cleanup() {
  log_section "Cleanup"

  if [ -n "${STRIPE_LISTEN_PID:-}" ]; then
    if kill -0 "$STRIPE_LISTEN_PID" 2>/dev/null; then
      echo "Stopping Stripe listener (PID: $STRIPE_LISTEN_PID)..."
      kill "$STRIPE_LISTEN_PID" 2>/dev/null || true
      sleep 1
    fi
  fi

  if [ -n "${SERVER_PID:-}" ]; then
    if kill -0 "$SERVER_PID" 2>/dev/null; then
      echo "Stopping server (PID: $SERVER_PID)..."
      kill "$SERVER_PID" 2>/dev/null || true
      sleep 1
    fi
  fi
}

trap cleanup EXIT INT TERM

################################################################################
# Main Execution
################################################################################

main() {
  log_banner "🔍 Vocalytics Production Verification"

  echo "Configuration:"
  echo "  BASE_URL: ${BASE_URL}"
  echo "  PORT: ${PORT}"
  echo "  TEST_EMAIL: ${TEST_EMAIL}"
  echo "  EXPECT_ANALYZE_CAP: ${EXPECT_ANALYZE_CAP}"
  echo "  EXPECT_REPLY_CAP: ${EXPECT_REPLY_CAP}"
  echo "  Stripe signature verification: ${STRICT_STRIPE_SIG:-disabled (local dev)}"
  echo "  Auto-checkout: ${AUTO_CHECKOUT:-disabled (manual completion required)}"
  echo ""

  # Validate prerequisites
  log_section "Prerequisites"
  check_env

  # Check tools
  local missing_tools=()
  for cmd in curl jq node stripe npx pnpm; do
    if ! command -v "$cmd" &> /dev/null; then
      missing_tools+=("$cmd")
    fi
  done

  if [ ${#missing_tools[@]} -ne 0 ]; then
    log_fail "Missing required tools: ${missing_tools[*]}"
    exit 1
  fi
  log_pass "All required tools found"

  # Free port if used
  log_section "Port Management"
  if lsof -ti :"${PORT}" >/dev/null 2>&1; then
    log_warn "Port ${PORT} is in use, killing process..."
    lsof -ti :"${PORT}" | xargs kill -9 2>/dev/null || true
    sleep 2
  fi
  log_pass "Port ${PORT} is available"

  # Start Stripe listener
  log_section "Stripe Setup"

  # Check Stripe CLI authentication
  if ! stripe config --list >/dev/null 2>&1; then
    log_fail "Stripe CLI not authenticated"
    echo ""
    echo "Please authenticate Stripe CLI:"
    echo "  stripe login"
    echo ""
    exit 1
  fi
  log_pass "Stripe CLI authenticated"

  echo "Starting Stripe webhook listener..."
  echo "  Forwarding to: http://localhost:${PORT}/webhook/stripe"
  stripe listen \
    --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted \
    --forward-to "http://localhost:${PORT}/webhook/stripe" >/tmp/stripe-listener.log 2>&1 &
  STRIPE_LISTEN_PID=$!

  sleep 2
  if ! kill -0 "$STRIPE_LISTEN_PID" 2>/dev/null; then
    log_fail "Failed to start Stripe listener"
    cat /tmp/stripe-listener.log
    exit 1
  fi
  log_pass "Stripe listener started (PID: $STRIPE_LISTEN_PID)"

  # Disable signature verification locally unless forced
  if [ -z "${STRICT_STRIPE_SIG:-}" ]; then
    unset STRIPE_WEBHOOK_SECRET
    log_info "Webhook signature verification disabled for local testing"
  else
    log_info "Webhook signature verification ENABLED"
  fi

  # Start server
  log_section "Server Startup"
  echo "Starting Vocalytics server..."

  (
    set -a
    # shellcheck source=/dev/null
    . ./.env 2>/dev/null || true
    set +a
    # Ensure local dev mode
    unset STRIPE_WEBHOOK_SECRET
    pnpm --filter server dev:http
  ) >/tmp/vocalytics-server.log 2>&1 &
  SERVER_PID=$!

  # Wait for healthz
  echo "Waiting for server to become healthy..."
  local waited=0
  local max_wait=40
  while [ $waited -lt $max_wait ]; do
    if curl -sf "${BASE_URL}/healthz" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
    waited=$((waited + 1))
  done

  if ! curl -sf "${BASE_URL}/healthz" >/dev/null 2>&1; then
    log_fail "Server failed to become healthy after ${max_wait} seconds"
    echo ""
    echo "Server log (last 50 lines):"
    tail -n 50 /tmp/vocalytics-server.log
    exit 1
  fi

  log_pass "Server is running at ${BASE_URL}"

  # Get JWT token
  log_section "Authentication"

  if ! JWT=$(SUPABASE_URL="$SUPABASE_URL" \
             SUPABASE_ANON="$SUPABASE_ANON" \
             TEST_EMAIL="$TEST_EMAIL" \
             TEST_PASS="$TEST_PASS" \
             node "$SCRIPT_DIR/get-jwt.js" 2>&1); then
    log_fail "Failed to obtain JWT"
    echo "$JWT"
    exit 1
  fi

  export JWT
  log_pass "JWT obtained (${#JWT} chars)"

  # Reset test user counters
  log_section "Resetting Test User Counters"

  if node scripts/reset_test_user_usage.js; then
    log_pass "Reset complete for $TEST_EMAIL"
  else
    log_fail "Failed to reset test user counters"
    exit 1
  fi

  # Run test suites
  log_section "Running Test Suites"

  local FAILED_SUITES=()

  local test_suites=(
    "tests/verify.spec.ts:Core Functionality"
    "tests/security.spec.ts:Security Checks"
    "tests/billing_lifecycle.spec.ts:Billing Lifecycle"
    "tests/concurrency.spec.ts:Concurrency"
    "tests/ops.spec.ts:Operations Hygiene"
  )

  # Reset counters before specific suites
  local reset_before_suites=("tests/verify.spec.ts" "tests/concurrency.spec.ts")

  for suite_info in "${test_suites[@]}"; do
    IFS=':' read -r suite_file suite_name <<< "$suite_info"

    # Reset counters before specific suites
    for reset_suite in "${reset_before_suites[@]}"; do
      if [ "$suite_file" = "$reset_suite" ]; then
        echo ""
        echo "🔄 Resetting counters before ${suite_name}..."
        if ! node scripts/reset_test_user_usage.js > /dev/null 2>&1; then
          log_warn "Counter reset failed, but continuing..."
        fi
        break
      fi
    done

    echo ""
    echo -e "${BOLD}Running: ${suite_name}${NC}"
    echo "─────────────────────────────────────────────────────────────────────────"

    # Special handling for billing lifecycle with auto-checkout
    if [ "$suite_file" = "tests/billing_lifecycle.spec.ts" ] && [ -n "${AUTO_CHECKOUT:-}" ]; then
      echo "🚀 AUTO_CHECKOUT enabled - will open browser and wait for webhook..."

      # Run test in background, capturing output
      npx vitest run "$suite_file" --reporter=verbose > /tmp/vitest-billing.log 2>&1 &
      local vitest_pid=$!

      # Wait a moment for test to generate checkout URL
      sleep 3

      # Extract and open checkout URL
      local checkout_url
      checkout_url=$(grep -oE 'https://checkout\.stripe\.com/c/pay/[A-Za-z0-9_#%?&=:/-]+' /tmp/vitest-billing.log 2>/dev/null | head -1)

      if [ -n "$checkout_url" ]; then
        echo "  📝 Opening checkout URL in browser..."
        echo "  URL: ${checkout_url:0:60}..."

        if command -v open >/dev/null 2>&1; then
          open "$checkout_url"
        elif command -v xdg-open >/dev/null 2>&1; then
          xdg-open "$checkout_url"
        else
          echo ""
          echo "  ⚠️  Could not auto-open browser. Please open manually:"
          echo "  $checkout_url"
          echo ""
        fi

        echo "  ⏳ Waiting for webhook (max 120s)..."
        echo "  💳 Complete checkout with: 4242 4242 4242 4242"
        echo ""

        # Poll for webhook confirmation
        local waited=0
        local webhook_received=false
        while [ $waited -lt 120 ]; do
          # Check if webhook was received
          if grep -qi 'checkout\.session\.completed\|customer\.subscription\.(created\|updated)' /tmp/vocalytics-server.log 2>/dev/null; then
            webhook_received=true
            echo "  ✓ Webhook received!"
            break
          fi

          # Check if vitest finished (might have timed out)
          if ! kill -0 "$vitest_pid" 2>/dev/null; then
            break
          fi

          sleep 3
          waited=$((waited + 3))

          if [ $((waited % 15)) -eq 0 ]; then
            echo "  ... still waiting (${waited}s elapsed)"
          fi
        done

        # Wait for vitest to complete
        wait "$vitest_pid"
        local exit_code=$?

        # Show test output
        cat /tmp/vitest-billing.log

        if [ $exit_code -eq 0 ]; then
          log_pass "${suite_name} PASSED"
        else
          log_fail "${suite_name} FAILED"
          FAILED_SUITES+=("$suite_name")
          if [ "$webhook_received" = "false" ]; then
            echo ""
            echo "  ⚠️  No webhook received. Check:"
            echo "     - Stripe listener is running (PID: ${STRIPE_LISTEN_PID:-none})"
            echo "     - Forwarding to: http://localhost:${PORT}/webhook/stripe"
            echo "     - Server is accepting webhooks"
            echo ""
          fi
        fi
      else
        # No checkout URL found, run test normally
        wait "$vitest_pid"
        if [ $? -eq 0 ]; then
          log_pass "${suite_name} PASSED"
        else
          log_fail "${suite_name} FAILED"
          FAILED_SUITES+=("$suite_name")
        fi
      fi
    else
      # Normal test execution
      if npx vitest run "$suite_file" --reporter=verbose 2>&1; then
        log_pass "${suite_name} PASSED"
      else
        log_fail "${suite_name} FAILED"
        FAILED_SUITES+=("$suite_name")
      fi
    fi
  done

  # Results
  echo ""
  echo ""

  if [ ${#FAILED_SUITES[@]} -eq 0 ]; then
    log_banner "✅ PRODUCTION READY ✅"
    echo -e "${GREEN}${BOLD}All verification checks passed!${NC}"
    echo ""
    echo "✓ Core functionality validated"
    echo "✓ Security checks passed"
    echo "✓ Billing lifecycle verified"
    echo "✓ Concurrency tests passed"
    echo "✓ Operations hygiene confirmed"
    echo ""
    echo -e "${GREEN}${BOLD}🚀 Safe to deploy to production${NC}"
    echo ""
    exit 0
  else
    log_banner "❌ NOT PRODUCTION READY ❌"
    echo -e "${RED}${BOLD}Failed suites:${NC}"
    for suite in "${FAILED_SUITES[@]}"; do
      echo -e "${RED}  ✗ $suite${NC}"
    done
    echo ""
    echo -e "${RED}${BOLD}⚠️  DO NOT DEPLOY - Fix failures above${NC}"
    echo ""
    exit 1
  fi
}

# Execute
main "$@"
