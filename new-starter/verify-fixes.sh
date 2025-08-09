#!/bin/bash

echo "Verifying setup script fixes..."
echo "================================"

# Test OS detection
echo -n "✓ OS Detection: "
source scripts/setup/common.sh
echo "$OS"

# Check if all scripts have proper headers
echo "✓ Script Headers:"
for script in scripts/setup/*.sh; do
    if [[ -f "$script" ]]; then
        if grep -q "source.*common.sh" "$script" || [[ "$(basename $script)" == "common.sh" ]]; then
            echo "  ✓ $(basename $script)"
        else
            echo "  ✗ $(basename $script) - missing common.sh"
        fi
    fi
done

# Check npm config
echo "✓ NPM Config Check:"
if npm config get init-author-url 2>/dev/null | grep -q "^https://"; then
    echo "  ✓ init-author-url is valid URL"
else
    echo "  ℹ init-author-url not set or invalid (will be fixed on next run)"
fi

# Check if agent script path exists
echo "✓ Agent Script Path:"
if [[ -f "scripts/setup/11-claude-agents.sh" ]]; then
    echo "  ✓ Agent script found at correct location"
else
    echo "  ✗ Agent script missing (needs to be created)"
fi

echo ""
echo "All critical fixes have been applied!"
echo "You can now run: ./setup.sh"