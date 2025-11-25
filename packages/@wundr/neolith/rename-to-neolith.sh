#!/bin/bash

# Script to rename @genesis packages to @neolith
set -e

echo "🔄 Renaming @genesis to @neolith..."

# Find and update all package.json files
find . -type f -name "package.json" \
  | grep -v node_modules \
  | grep -v ".next" \
  | while IFS= read -r file; do
    echo "  Processing: $file"
    # Use perl for cross-platform compatibility
    perl -i -pe 's/"@genesis\//"@neolith\//g' "$file"
  done

echo "✅ Package names updated in package.json files"

# Find and update all TypeScript/JavaScript import statements
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  | grep -v node_modules \
  | grep -v ".next" \
  | grep -v "dist" \
  | while IFS= read -r file; do
    # Check if file contains @genesis imports
    if grep -q "from.*['\"]@genesis/" "$file" 2>/dev/null; then
      echo "  Updating imports in: $file"
      perl -i -pe "s/from (['\"])@genesis\//from \$1@neolith\//g" "$file"
      perl -i -pe "s/import (['\"])@genesis\//import \$1@neolith\//g" "$file"
      perl -i -pe "s/require\\((['\"])@genesis\\//require(\$1@neolith\//g" "$file"
    fi
  done

echo "✅ Import statements updated"

# Update package directory references
echo "  Renaming package directories..."
if [ -d "./packages/@genesis" ]; then
  mv ./packages/@genesis ./packages/@neolith
  echo "  ✅ Renamed ./packages/@genesis to ./packages/@neolith"
fi

echo ""
echo "🎉 Rebrand complete! @genesis/* → @neolith/*"
echo ""
echo "Next steps:"
echo "1. Run: pnpm install"
echo "2. Run: pnpm run build"
echo "3. Run: pnpm run typecheck"
