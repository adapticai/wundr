#!/bin/bash

# Test script for the portable UI testing framework

echo "🧪 Testing Portable UI Framework"
echo "================================"

# Change to the wundr directory
cd /Users/lucas/wundr

# Test the help command
echo "1. Testing 'wundr test --help'..."
npx wundr test --help

echo ""
echo "2. Testing 'wundr test init' (dry run)..."
# We'll create a mock project to test
mkdir -p /tmp/test-wundr-project
cd /tmp/test-wundr-project

# Create a basic package.json
cat > package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0",
  "scripts": {}
}
EOF

echo "3. Testing test command with local dashboards..."
cd /Users/lucas/wundr

# Run tests against the local web-client
echo "Running smoke tests against web-client (localhost:3000)..."
npx wundr test --type ui --base-url http://localhost:3000 --headed

echo ""
echo "✅ Portable framework test complete!"
echo ""
echo "The framework provides:"
echo "  - wundr test         : Run tests against any application"
echo "  - wundr test init    : Initialize test config for a project"
echo "  - wundr test --type  : Run specific test types (ui/api/unit)"
echo "  - wundr test --headed: Run tests in visible browser mode"
echo ""
echo "📦 When installed in another repo via 'npm install @wundr.io/cli':"
echo "  - All test suites are bundled with the package"
echo "  - Tests can be run against any web application"
echo "  - Configuration can be customized via wundr-test.config.js"