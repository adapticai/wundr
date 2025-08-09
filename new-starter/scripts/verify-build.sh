#!/bin/bash

set -e

echo "🔍 Verifying new-starter build..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm ci
fi

# Build the project
echo "🔨 Building TypeScript..."
npm run build

# Check if dist directory was created
if [ ! -d "dist" ]; then
  echo "❌ Build failed: dist directory not created"
  exit 1
fi

# Check if main files exist
FILES=(
  "dist/cli.js"
  "dist/index.js"
  "dist/index.d.ts"
  "bin/new-starter.js"
)

for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing file: $file"
    exit 1
  fi
  echo "✅ Found: $file"
done

# Make bin script executable
chmod +x bin/new-starter.js

# Run type check
echo "📝 Type checking..."
npm run type-check

# Run linting
echo "🎨 Linting..."
npm run lint

# Run tests
echo "🧪 Running tests..."
npm test

echo ""
echo "✅ Build verification complete!"
echo ""
echo "📦 Package is ready to publish:"
echo "  npm publish --access public"
echo ""
echo "🚀 Or test locally:"
echo "  npm link"
echo "  new-starter --version"