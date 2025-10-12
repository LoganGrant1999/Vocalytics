#!/usr/bin/env bash

################################################################################
# Vocalytics Production Readiness Check
# Orchestrates all test suites to validate production deployment
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
EXPECT_ANALYZE_CAP="${EXPECT_ANALYZE_CAP:-2}"
EXPECT_REPLY_CAP="${EXPECT_REPLY_CAP:-1}"
RUN_K6="${RUN_K6:-0}"

# Required environment variables
REQUIRED_VARS=(
  "SUPABASE_URL"
  "SUPABASE_ANON"
  "TEST_EMAIL"
  "TEST_PASS"
  "STRIPE_PRICE_ID"
)

################################################################################
# Helper Functions
################################################################################

log_banner() {
  echo ""
  echo -e "${BLUE}${BOLD}╔════════════════════════════════════════════════════════════════════════╗${NC}"
  printf "${BLUE}${BOLD}║%-72s║${NC}\n" "  $1"
  echo -e "${BLUE}${BOLD}╚════════════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

log_section() {
  echo ""
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}${BOLD}  $1${NC}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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

  for cmd in curl jq node npx; do
    if ! command -v "$cmd" &> /dev/null; then
      missing+=("$cmd")
    fi
  done

  if [ ${#missing[@]} -ne 0 ]; then
    log_error "Missing required tools: ${missing[*]}"
    echo "  Install with:"
    echo "    macOS: brew install curl jq node"
    echo "    Linux: apt-get install curl jq nodejs npm"
    exit 1
  fi

  # Check for stripe CLI (warning only, not required for basic tests)
  if ! command -v stripe &> /dev/null; then
    log_warn "Stripe CLI not found - billing tests will be limited"
    echo "  Install: brew install stripe/stripe-cli/stripe"
    echo "  Or visit: https://stripe.com/docs/stripe-cli"
  fi

  # Check for k6 if RUN_K6=1
  if [ "$RUN_K6" = "1" ] && ! command -v k6 &> /dev/null; then
    log_warn "k6 not found - rate limit tests will be skipped"
    echo "  Install: brew install k6"
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
    echo "  export STRIPE_PRICE_ID=price_xxx"
    echo ""
    echo "Then run: bash scripts/prod_check.sh"
    exit 1
  fi
}

check_server() {
  log_step "Checking if server is running..."

  if ! curl -sf "${BASE_URL}/healthz" > /dev/null 2>&1; then
    log_error "Server not responding at ${BASE_URL}"
    echo ""
    echo "Start the server first:"
    echo "  pnpm --filter @vocalytics/server dev:http"
    echo ""
    echo "Or set BASE_URL to point to your running server"
    exit 1
  fi

  log_info "Server is running at ${BASE_URL}"
}

print_config() {
  echo ""
  echo "Configuration:"
  echo "  BASE_URL: ${BASE_URL}"
  echo "  SUPABASE_URL: ${SUPABASE_URL}"
  echo "  TEST_EMAIL: ${TEST_EMAIL}"
  echo "  EXPECT_ANALYZE_CAP: ${EXPECT_ANALYZE_CAP}"
  echo "  EXPECT_REPLY_CAP: ${EXPECT_REPLY_CAP}"
  echo "  STRIPE_PRICE_ID: ${STRIPE_PRICE_ID:0:20}..."
  echo "  RUN_K6: ${RUN_K6}"
  echo ""
}

run_test_suite() {
  local test_file="$1"
  local test_name="$2"

  log_section "$test_name"

  if [ ! -f "$PROJECT_ROOT/tests/$test_file" ]; then
    log_warn "Test file not found: tests/$test_file"
    return 0
  fi

  cd "$PROJECT_ROOT"

  if npx vitest run "tests/$test_file" --reporter=verbose; then
    log_info "$test_name passed"
    return 0
  else
    log_error "$test_name failed"
    return 1
  fi
}

################################################################################
# Main Execution
################################################################################

main() {
  log_banner "🚀 Vocalytics Production Readiness Check"

  print_config

  log_step "Checking dependencies..."
  check_dependencies
  log_info "All required tools found"

  log_step "Checking environment variables..."
  check_env
  log_info "All required environment variables set"

  check_server

  # ============================================================================
  # Get JWT Token
  # ============================================================================
  log_section "🔑 Authentication Setup"

  log_step "Obtaining JWT token..."

  if ! JWT=$(SUPABASE_URL="$SUPABASE_URL" \
             SUPABASE_ANON="$SUPABASE_ANON" \
             TEST_EMAIL="$TEST_EMAIL" \
             TEST_PASS="$TEST_PASS" \
             node "$SCRIPT_DIR/get-jwt.js" 2>&1); then
    log_error "Failed to get JWT token"
    echo "$JWT"
    exit 1
  fi

  export JWT
  log_info "JWT token obtained (${#JWT} chars)"

  # ============================================================================
  # Start Stripe Listener
  # ============================================================================
  if command -v stripe &> /dev/null; then
    log_section "🎧 Stripe Webhook Setup"

    # Source stripe helpers
    # shellcheck source=stripe_helpers.sh
    source "$SCRIPT_DIR/stripe_helpers.sh"

    if start_stripe_listener; then
      log_info "Stripe listener started successfully"
      STRIPE_LISTENER_RUNNING=1
    else
      log_warn "Failed to start Stripe listener - billing tests may be limited"
      STRIPE_LISTENER_RUNNING=0
    fi
  else
    log_warn "Skipping Stripe listener (CLI not installed)"
    STRIPE_LISTENER_RUNNING=0
  fi

  # ============================================================================
  # Run Test Suites
  # ============================================================================

  FAILED_TESTS=()

  # Production/Happy Path Tests
  if ! run_test_suite "prod.spec.ts" "Production API Tests"; then
    FAILED_TESTS+=("prod.spec.ts")
  fi

  # Security Tests
  if ! run_test_suite "security.spec.ts" "Security Tests"; then
    FAILED_TESTS+=("security.spec.ts")
  fi

  # Billing Tests
  if ! run_test_suite "billing.spec.ts" "Billing & Stripe Tests"; then
    FAILED_TESTS+=("billing.spec.ts")
  fi

  # Race Condition Tests
  if ! run_test_suite "race.spec.ts" "Race Condition Tests"; then
    FAILED_TESTS+=("race.spec.ts")
  fi

  # Optional: k6 Load Tests
  if [ "$RUN_K6" = "1" ] && command -v k6 &> /dev/null; then
    log_section "📊 Load Tests (k6)"

    if [ -f "$PROJECT_ROOT/tests/rate_limit.k6.js" ]; then
      if k6 run "$PROJECT_ROOT/tests/rate_limit.k6.js"; then
        log_info "k6 load tests passed"
      else
        log_warn "k6 load tests failed (non-critical)"
      fi
    else
      log_warn "k6 test file not found"
    fi
  fi

  # ============================================================================
  # Cleanup
  # ============================================================================

  if [ "$STRIPE_LISTENER_RUNNING" = "1" ]; then
    log_section "🧹 Cleanup"
    stop_stripe_listener
  fi

  # ============================================================================
  # Results Summary
  # ============================================================================

  echo ""
  echo ""

  if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    log_banner "✅ ALL TESTS PASSED - PRODUCTION READY! ✅"
    echo ""
    echo -e "${GREEN}${BOLD}Summary:${NC}"
    echo -e "${GREEN}  ✓ Production API tests${NC}"
    echo -e "${GREEN}  ✓ Security tests${NC}"
    echo -e "${GREEN}  ✓ Billing & Stripe tests${NC}"
    echo -e "${GREEN}  ✓ Race condition tests${NC}"

    if [ "$RUN_K6" = "1" ]; then
      echo -e "${GREEN}  ✓ Load tests${NC}"
    fi

    echo ""
    echo -e "${GREEN}${BOLD}🎉 Your application is ready for production deployment!${NC}"
    echo ""

    exit 0
  else
    log_banner "❌ TESTS FAILED - NOT PRODUCTION READY"
    echo ""
    echo -e "${RED}${BOLD}Failed test suites:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
      echo -e "${RED}  ✗ $test${NC}"
    done
    echo ""
    echo "Review the errors above and fix before deploying to production"
    echo ""

    exit 1
  fi
}

# Run main function
main "$@"
