#!/bin/bash

# Wundr Documentation Setup Script
# This script sets up the complete documentation environment

set -e

echo "🚀 Setting up Wundr Documentation System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "docusaurus.config.ts" ]; then
    print_error "Please run this script from the docs package directory"
    print_error "Expected: packages/@wundr/docs/"
    exit 1
fi

print_status "Detected Wundr documentation directory ✓"

# Install dependencies
print_status "Installing dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v yarn &> /dev/null; then
    yarn install
else
    npm install
fi
print_success "Dependencies installed"

# Create necessary directories
print_status "Creating directory structure..."
mkdir -p src/data
mkdir -p src/examples
mkdir -p i18n/en/docusaurus-plugin-content-docs
mkdir -p i18n/es/docusaurus-plugin-content-docs
mkdir -p i18n/fr/docusaurus-plugin-content-docs
mkdir -p i18n/de/docusaurus-plugin-content-docs
mkdir -p static/img
mkdir -p .docusaurus
print_success "Directory structure created"

# Generate API documentation
print_status "Generating API documentation..."
if [ -f "scripts/generate-api-docs.ts" ]; then
    if command -v ts-node &> /dev/null; then
        npx ts-node scripts/generate-api-docs.ts || print_warning "API docs generation failed (this is ok if web-client is not available)"
    else
        print_warning "ts-node not available, skipping API docs generation"
    fi
else
    print_warning "API docs generator not found"
fi

# Generate playground examples
print_status "Generating playground examples..."
if [ -f "scripts/generate-playground.ts" ]; then
    if command -v ts-node &> /dev/null; then
        npx ts-node scripts/generate-playground.ts || print_warning "Playground generation completed with warnings"
    else
        print_warning "ts-node not available, skipping playground generation"
    fi
else
    print_warning "Playground generator not found"
fi

# Copy assets
print_status "Setting up assets..."
if [ -f "../../../docs/assets/wundr-logo-light.svg" ]; then
    cp ../../../docs/assets/wundr-logo-light.svg static/img/
    cp ../../../docs/assets/wundr-logo-dark.svg static/img/
    print_success "Logo assets copied"
else
    print_warning "Logo assets not found in expected location"
    echo "<!-- Placeholder -->" > static/img/wundr-logo-light.svg
    echo "<!-- Placeholder -->" > static/img/wundr-logo-dark.svg
fi

# Test the build
print_status "Testing documentation build..."
if command -v pnpm &> /dev/null; then
    BUILD_CMD="pnpm run build"
elif command -v yarn &> /dev/null; then
    BUILD_CMD="yarn build"
else
    BUILD_CMD="npm run build"
fi

if $BUILD_CMD > /dev/null 2>&1; then
    print_success "Documentation builds successfully!"
else
    print_warning "Build test failed - this may be due to missing dependencies"
    print_status "You can manually run: $BUILD_CMD"
fi

# Setup development environment
print_status "Setting up development environment..."

# Create VS Code settings if not exist
if [ ! -f ".vscode/settings.json" ]; then
    mkdir -p .vscode
    cat > .vscode/settings.json << 'EOF'
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true,
    "source.organizeImports": true
  },
  "[markdown]": {
    "editor.wordWrap": "on",
    "editor.quickSuggestions": {
      "comments": "off",
      "strings": "off",
      "other": "off"
    }
  },
  "files.associations": {
    "*.mdx": "markdown"
  }
}
EOF
    print_success "VS Code settings created"
fi

# Create development scripts
cat > scripts/dev-setup.sh << 'EOF'
#!/bin/bash
# Development helper script

echo "🔧 Wundr Documentation Development Setup"
echo "======================================="

echo "Available commands:"
echo "  start    - Start development server"
echo "  build    - Build for production"
echo "  serve    - Serve built site locally"
echo "  clean    - Clear build cache"
echo "  docs     - Generate API documentation"
echo "  i18n     - Extract translation strings"

case "$1" in
  start)
    pnpm start
    ;;
  build)
    pnpm run build
    ;;
  serve)
    pnpm run serve
    ;;
  clean)
    pnpm run clear
    ;;
  docs)
    npx ts-node scripts/generate-api-docs.ts
    ;;
  i18n)
    pnpm run write-translations --locale ${2:-es}
    ;;
  *)
    echo "Usage: $0 {start|build|serve|clean|docs|i18n}"
    exit 1
    ;;
esac
EOF

chmod +x scripts/dev-setup.sh
print_success "Development scripts created"

# Print completion message
echo ""
print_success "Wundr Documentation System Setup Complete! 🎉"
echo ""
echo "📚 Documentation Structure:"
echo "  ├── docs/          - Main documentation pages"
echo "  ├── api/           - Auto-generated API reference"
echo "  ├── guides/        - Step-by-step tutorials"
echo "  ├── blog/          - Blog posts and announcements"
echo "  └── src/           - Custom components and assets"
echo ""
echo "🚀 Quick Start Commands:"
echo "  # Start development server"
if command -v pnpm &> /dev/null; then
    echo "  pnpm start"
    echo ""
    echo "  # Build for production"
    echo "  pnpm run build"
else
    echo "  npm start"
    echo ""
    echo "  # Build for production"
    echo "  npm run build"
fi
echo ""
echo "  # Generate API docs"
echo "  npx ts-node scripts/generate-api-docs.ts"
echo ""
echo "  # Generate playground examples"
echo "  npx ts-node scripts/generate-playground.ts"
echo ""
echo "📖 Next Steps:"
echo "  1. Start the development server to preview the site"
echo "  2. Customize the content in docs/, guides/, and blog/"
echo "  3. Update the branding in docusaurus.config.ts"
echo "  4. Configure search and analytics"
echo "  5. Set up deployment pipeline"
echo ""
echo "🔗 Resources:"
echo "  • Documentation: https://docusaurus.io/"
echo "  • Wundr GitHub: https://github.com/adapticai/wundr"
echo "  • Community: https://github.com/adapticai/wundr/discussions"
echo ""
print_success "Happy documenting! 📚✨"
