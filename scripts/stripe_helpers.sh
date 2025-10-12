#!/usr/bin/env bash

################################################################################
# Stripe Helper Functions for Vocalytics Testing
# Provides utilities for Stripe CLI operations during testing
################################################################################

# Global variables
STRIPE_LISTENER_PID=""
STRIPE_LISTENER_LOG="/tmp/vocalytics_stripe_listener.log"
STRIPE_WEBHOOK_ENDPOINT=""

################################################################################
# Helper Functions
################################################################################

check_stripe_cli() {
  if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found"
    echo "   Install: https://stripe.com/docs/stripe-cli"
    echo "   macOS: brew install stripe/stripe-cli/stripe"
    echo "   Login: stripe login"
    return 1
  fi

  # Check if logged in
  if ! stripe config --list &> /dev/null; then
    echo "❌ Stripe CLI not authenticated"
    echo "   Run: stripe login"
    return 1
  fi

  return 0
}

start_stripe_listener() {
  local base_url="${BASE_URL:-http://localhost:3000}"
  local webhook_path="/webhook/stripe"

  echo "🎧 Starting Stripe webhook listener..."

  if ! check_stripe_cli; then
    return 1
  fi

  # Kill any existing listener
  if [ -n "$STRIPE_LISTENER_PID" ] && kill -0 "$STRIPE_LISTENER_PID" 2>/dev/null; then
    echo "⚠️  Stopping existing listener (PID: $STRIPE_LISTENER_PID)"
    kill "$STRIPE_LISTENER_PID" 2>/dev/null || true
    sleep 1
  fi

  # Start listener in background
  STRIPE_WEBHOOK_ENDPOINT="${base_url}${webhook_path}"

  echo "   Forwarding to: $STRIPE_WEBHOOK_ENDPOINT"

  # Start listener and capture output
  stripe listen --forward-to "$STRIPE_WEBHOOK_ENDPOINT" > "$STRIPE_LISTENER_LOG" 2>&1 &
  STRIPE_LISTENER_PID=$!

  # Wait for listener to start and extract webhook secret
  local max_wait=10
  local waited=0

  while [ $waited -lt $max_wait ]; do
    if [ -f "$STRIPE_LISTENER_LOG" ]; then
      # Look for webhook signing secret in log
      local secret
      secret=$(grep -o 'whsec_[a-zA-Z0-9_]*' "$STRIPE_LISTENER_LOG" 2>/dev/null | head -1)

      if [ -n "$secret" ]; then
        export STRIPE_WEBHOOK_SECRET="$secret"
        echo "✓ Listener started (PID: $STRIPE_LISTENER_PID)"
        echo "✓ Webhook secret: ${secret:0:20}..."
        echo ""
        echo "⚠️  IMPORTANT: Update server .env with:"
        echo "   STRIPE_WEBHOOK_SECRET=$secret"
        echo "   Then restart server for webhook verification to work"
        echo ""
        return 0
      fi
    fi

    sleep 1
    waited=$((waited + 1))
  done

  echo "❌ Failed to start Stripe listener or extract webhook secret"
  cat "$STRIPE_LISTENER_LOG" 2>/dev/null
  return 1
}

stop_stripe_listener() {
  if [ -z "$STRIPE_LISTENER_PID" ]; then
    echo "ℹ️  No Stripe listener PID stored"
    return 0
  fi

  if kill -0 "$STRIPE_LISTENER_PID" 2>/dev/null; then
    echo "🛑 Stopping Stripe listener (PID: $STRIPE_LISTENER_PID)..."
    kill "$STRIPE_LISTENER_PID" 2>/dev/null || true
    sleep 1

    # Force kill if still running
    if kill -0 "$STRIPE_LISTENER_PID" 2>/dev/null; then
      kill -9 "$STRIPE_LISTENER_PID" 2>/dev/null || true
    fi

    echo "✓ Listener stopped"
  else
    echo "ℹ️  Listener already stopped"
  fi

  STRIPE_LISTENER_PID=""

  # Clean up log file
  rm -f "$STRIPE_LISTENER_LOG"
}

resend_last_event() {
  echo "🔄 Resending last Stripe event..."

  if ! check_stripe_cli; then
    return 1
  fi

  # Get last event ID
  local event_id
  event_id=$(stripe events list --limit 1 --format json 2>/dev/null | jq -r '.data[0].id')

  if [ -z "$event_id" ] || [ "$event_id" = "null" ]; then
    echo "❌ No events found to resend"
    return 1
  fi

  echo "   Event ID: $event_id"

  # Resend to webhook endpoint
  if [ -n "$STRIPE_WEBHOOK_ENDPOINT" ]; then
    stripe events resend "$event_id" --webhook-endpoint "$STRIPE_WEBHOOK_ENDPOINT"
    echo "✓ Event resent to $STRIPE_WEBHOOK_ENDPOINT"
  else
    # Just trigger webhook via listener if endpoint not set
    stripe events resend "$event_id"
    echo "✓ Event resent via listener"
  fi
}

create_test_clock_and_advance() {
  local customer_id="$1"
  local advance_seconds="${2:-86400}"  # Default 1 day

  echo "⏰ Creating Stripe Test Clock..."

  if ! check_stripe_cli; then
    return 1
  fi

  if [ -z "$customer_id" ]; then
    echo "❌ Customer ID required"
    echo "   Usage: create_test_clock_and_advance <customer_id> [seconds]"
    return 1
  fi

  # Create test clock
  local clock_id
  clock_id=$(stripe test_helpers.test_clocks create \
    --frozen-time "$(date -u +%s)" \
    --format json 2>/dev/null | jq -r '.id')

  if [ -z "$clock_id" ] || [ "$clock_id" = "null" ]; then
    echo "❌ Failed to create test clock"
    return 1
  fi

  echo "✓ Test clock created: $clock_id"

  # Advance clock
  echo "⏩ Advancing clock by $advance_seconds seconds..."

  stripe test_helpers.test_clocks advance "$clock_id" \
    --frozen-time "$(($(date -u +%s) + advance_seconds))"

  echo "✓ Clock advanced"
  echo "   Clock ID: $clock_id"
  echo "   Customer: $customer_id"

  export TEST_CLOCK_ID="$clock_id"
}

trigger_subscription_webhook() {
  local subscription_id="$1"
  local event_type="${2:-customer.subscription.updated}"

  echo "📡 Triggering webhook: $event_type..."

  if [ -z "$subscription_id" ]; then
    echo "❌ Subscription ID required"
    return 1
  fi

  # Use Stripe CLI to trigger webhook event
  stripe trigger "$event_type" \
    --override "subscription:id=$subscription_id" \
    2>/dev/null

  echo "✓ Webhook triggered"
}

wait_for_webhook_processing() {
  local max_wait="${1:-30}"
  local check_cmd="${2:-true}"  # Command to run to check if processed

  echo "⏳ Waiting for webhook processing (max ${max_wait}s)..."

  local waited=0
  while [ $waited -lt $max_wait ]; do
    if eval "$check_cmd" 2>/dev/null; then
      echo "✓ Webhook processed (${waited}s)"
      return 0
    fi

    sleep 2
    waited=$((waited + 2))

    if [ $((waited % 10)) -eq 0 ]; then
      echo "   Still waiting... (${waited}s)"
    fi
  done

  echo "❌ Webhook not processed after ${max_wait}s"
  return 1
}

################################################################################
# Cleanup on exit
################################################################################

cleanup_stripe() {
  stop_stripe_listener
}

# Register cleanup on script exit
trap cleanup_stripe EXIT INT TERM
