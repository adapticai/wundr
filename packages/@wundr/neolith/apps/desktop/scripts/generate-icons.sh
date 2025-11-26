#!/bin/bash

# Icon Generation Script for Neolith Desktop
# This script generates Windows .ico files from the source PNG

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$(dirname "$SCRIPT_DIR")/build"
SOURCE_PNG="$BUILD_DIR/icon.png"
OUTPUT_ICO="$BUILD_DIR/icon.ico"

echo "Neolith Desktop - Icon Generation Script"
echo "=========================================="
echo ""

# Check if source PNG exists
if [ ! -f "$SOURCE_PNG" ]; then
    echo "Error: Source icon not found at $SOURCE_PNG"
    exit 1
fi

echo "Source icon: $SOURCE_PNG"
echo "Output icon: $OUTPUT_ICO"
echo ""

# Try different methods to generate .ico
if command -v convert &> /dev/null; then
    echo "Using ImageMagick (convert)..."
    convert "$SOURCE_PNG" -define icon:auto-resize=256,128,96,64,48,32,16 "$OUTPUT_ICO"
    echo "✓ Successfully generated icon.ico using ImageMagick"
elif command -v png-to-ico &> /dev/null; then
    echo "Using png-to-ico..."
    png-to-ico "$SOURCE_PNG" > "$OUTPUT_ICO"
    echo "✓ Successfully generated icon.ico using png-to-ico"
elif command -v sips &> /dev/null; then
    echo "Using macOS sips (limited quality)..."
    echo "⚠️  Note: sips produces lower quality .ico files"
    echo "⚠️  Consider using ImageMagick or png-to-ico for better results"

    # Create a temporary ICNS file
    TEMP_ICNS="$BUILD_DIR/temp_icon.icns"
    sips -s format icns "$SOURCE_PNG" --out "$TEMP_ICNS"

    # Rename to .ico (note: this is a hack and may not work perfectly)
    mv "$TEMP_ICNS" "$OUTPUT_ICO"
    echo "✓ Generated icon.ico using sips"
else
    echo "❌ Error: No suitable icon conversion tool found"
    echo ""
    echo "Please install one of the following:"
    echo "  - ImageMagick: brew install imagemagick"
    echo "  - png-to-ico: npm install -g png-to-ico"
    echo ""
    echo "Or manually convert $SOURCE_PNG to .ico format"
    echo "See build/ICON_GENERATION.md for more information"
    exit 1
fi

echo ""
echo "Icon generation complete!"
echo "Verify the icon at: $OUTPUT_ICO"
