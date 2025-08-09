#!/bin/bash

# Test script to verify setup configuration

echo "Testing new-starter setup configuration..."
echo "=========================================="
echo ""

# Test with custom root directory
echo "Example command with custom root directory:"
echo "./setup.sh \\"
echo "  --email 'john.doe@company.com' \\"
echo "  --github-username 'johndoe' \\"
echo "  --name 'John Doe' \\"
echo "  --company 'Awesome Corp' \\"
echo "  --root-dir '$HOME/MyDevEnvironment' \\"
echo "  --skip-prompts"
echo ""

# Show what directories would be created
echo "Directories that will be created with --root-dir '$HOME/MyDevEnvironment':"
echo "  - $HOME/MyDevEnvironment/"
echo "  - $HOME/MyDevEnvironment/projects/"
echo "  - $HOME/MyDevEnvironment/tools/"
echo "  - $HOME/MyDevEnvironment/sandbox/"
echo "  - $HOME/MyDevEnvironment/.config/"
echo "  - $HOME/MyDevEnvironment/.claude-flow/"
echo ""

# Show global config locations
echo "Global configurations will be stored in:"
echo "  - $HOME/MyDevEnvironment/.workspace"
echo "  - $HOME/MyDevEnvironment/.claude-flow/global-config.json"
echo ""

echo "Claude Flow will use this root directory for:"
echo "  - Swarm orchestration base"
echo "  - Memory persistence (SQLite)"
echo "  - Project templates"
echo "  - Hooks and neural patterns"
echo ""

echo "Test complete!"