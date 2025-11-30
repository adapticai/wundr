#!/bin/bash
# Verify configuration system is working correctly

set -e

echo "════════════════════════════════════════════════════════"
echo "  Orchestrator Daemon Configuration Verification"
echo "════════════════════════════════════════════════════════"
echo

# Check if .env.example exists
echo "✓ Checking .env.example..."
if [ ! -f ".env.example" ]; then
    echo "✗ .env.example not found!"
    exit 1
fi
echo "  Found .env.example ($(wc -l < .env.example) lines)"
echo

# Check if config module exists
echo "✓ Checking config module..."
if [ ! -f "src/config/index.ts" ]; then
    echo "✗ src/config/index.ts not found!"
    exit 1
fi
echo "  Found config module"
echo

# Check if config compiles
echo "✓ Checking TypeScript compilation..."
npx tsc --noEmit --skipLibCheck src/config/index.ts 2>&1 | grep -q "error TS" && {
    echo "✗ TypeScript errors found!"
    exit 1
} || echo "  Config module compiles successfully"
echo

# Check required environment variables
echo "✓ Checking environment variable documentation..."
grep -q "OPENAI_API_KEY" .env.example || {
    echo "✗ OPENAI_API_KEY not documented in .env.example!"
    exit 1
}
echo "  Required variables documented"
echo

# Count configuration options
echo "✓ Configuration coverage:"
TOTAL_VARS=$(grep -c "^[A-Z_]*=" .env.example || echo 0)
echo "  Total environment variables: $TOTAL_VARS"
echo

# Check for config export in package.json
echo "✓ Checking package.json exports..."
if grep -q '"./config"' package.json; then
    echo "  Config export configured in package.json"
else
    echo "  Warning: Config export may not be configured in package.json"
fi
echo

echo "════════════════════════════════════════════════════════"
echo "  All verification checks passed!"
echo "════════════════════════════════════════════════════════"
echo
echo "To use the configuration system:"
echo "  1. cp .env.example .env"
echo "  2. Edit .env and set OPENAI_API_KEY"
echo "  3. Import: import { getConfig } from '@wundr.io/orchestrator-daemon/config'"
echo
