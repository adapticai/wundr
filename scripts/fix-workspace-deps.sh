#!/bin/bash

# Fix workspace dependencies for npm publishing
# Replaces "workspace:*" with actual version numbers

set -e

VERSION=${1:-"1.0.0"}

echo "🔧 Fixing workspace dependencies for npm publishing..."
echo "   Using version: ^${VERSION}"

# Find all package.json files
find packages -name "package.json" -not -path "*/node_modules/*" | while read pkg; do
  echo "   Processing: $pkg"

  # Replace workspace:* with version
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' 's/"workspace:\*"/"^'"${VERSION}"'"/g' "$pkg"
  else
    # Linux
    sed -i 's/"workspace:\*"/"^'"${VERSION}"'"/g' "$pkg"
  fi
done

echo "✅ Workspace dependencies fixed!"
