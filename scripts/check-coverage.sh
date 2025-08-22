#!/bin/bash
# scripts/check-coverage.sh

echo "🔍 Checking test coverage..."

# Run tests with coverage
npm run test:coverage

# Check if coverage meets requirements
if [ $? -eq 0 ]; then
  echo "✅ Coverage requirements met"
else
  echo "❌ Coverage below requirements"
  echo "Run 'npm run test:coverage' to see detailed report"
  exit 1
fi