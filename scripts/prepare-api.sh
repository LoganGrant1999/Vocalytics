#!/bin/bash
# Force copy our api/index.ts to ensure it's deployed correctly

echo "Preparing API files for Vercel deployment..."

# Ensure our api/index.ts is the router, not the old one
if [ -f "api/index.ts" ]; then
  if grep -q "Re-export the handler" "api/index.ts"; then
    echo "ERROR: Old api/index.ts detected! Removing..."
    rm api/index.ts
  fi
fi

echo "API preparation complete"
