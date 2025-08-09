#!/bin/bash

# Script to update all dependencies to latest versions
# This ensures we don't lock to specific versions unnecessarily

set -euo pipefail

echo "===================================================="
echo "Update All Dependencies to Latest Versions"
echo "===================================================="
echo ""

# Function to update package.json dependencies
update_package_json() {
    local file="$1"
    local temp_file="${file}.tmp"
    
    if [ ! -f "$file" ]; then
        echo "File not found: $file"
        return 1
    fi
    
    echo "Updating $file..."
    
    # Create a backup
    cp "$file" "${file}.backup"
    
    # Use jq to update all dependencies to use "latest" or caret ranges
    jq '
    .dependencies = (.dependencies // {} | with_entries(.value = "^" + (.value | sub("^[~^]"; "") | sub("^([0-9]+\\.[0-9]+\\.[0-9]+.*)$"; "\\1") | sub("^([0-9]+)$"; "\\1.0.0"))))
    | .devDependencies = (.devDependencies // {} | with_entries(.value = "^" + (.value | sub("^[~^]"; "") | sub("^([0-9]+\\.[0-9]+\\.[0-9]+.*)$"; "\\1") | sub("^([0-9]+)$"; "\\1.0.0"))))
    ' "$file" > "$temp_file"
    
    mv "$temp_file" "$file"
    
    echo "✓ Updated $file"
}

# Main execution
main() {
    echo "This script will update all package.json files to use latest versions."
    echo "Original files will be backed up with .backup extension."
    echo ""
    
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    
    echo ""
    
    # Find and update all package.json files
    find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read -r pkg_file; do
        update_package_json "$pkg_file"
    done
    
    echo ""
    echo "===================================================="
    echo "Updates Complete!"
    echo "===================================================="
    echo ""
    echo "Next steps:"
    echo "1. Review the changes with: git diff"
    echo "2. Run: npm update (in each directory)"
    echo "3. Test the application"
    echo "4. Commit the changes if everything works"
    echo ""
    echo "To restore original files, use the .backup files"
}

# Run if not sourced
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi