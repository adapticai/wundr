#!/bin/bash

echo "Fixing npx cache and Node module version conflicts..."

# Clear the npx cache completely
echo "Removing npx cache..."
rm -rf ~/.npm/_npx 2>/dev/null || sudo rm -rf ~/.npm/_npx

# Clear npm cache
echo "Clearing npm cache..."
npm cache clean --force

# Verify Node version
echo "Current Node version:"
node --version

echo ""
echo "Fix completed! Try running your npx command again."
echo ""
echo "If you still see issues, you may need to:"
echo "1. Check your Node version: node --version"
echo "2. The error shows it needs NODE_MODULE_VERSION 115 (Node v20)"
echo "3. If you have nvm, try: nvm use 20"
echo ""