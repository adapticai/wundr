#!/bin/bash

# RAG Infrastructure Setup Script
# Sets up Gemini AI RAG (Retrieval-Augmented Generation) infrastructure for Wundr

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# RAG store paths
RAG_BASE_DIR="$HOME/.wundr/rag-stores"
RAG_GLOBAL_DIR="$RAG_BASE_DIR/global"
RAG_PROJECT_DIR="$RAG_BASE_DIR/project-specific"

# Function to print colored output
print_header() {
    echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}      ${GREEN}Wundr RAG Infrastructure Setup${NC}              ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_step() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Step $1:${NC} $2"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Check if running on macOS or Linux
check_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    else
        print_error "Unsupported operating system: $OSTYPE"
        print_status "This script supports macOS and Linux only."
        exit 1
    fi
    print_status "Detected OS: $OS"
}

# Check Node.js and npm availability
check_node() {
    print_step 1 "Checking Node.js environment"

    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi

    NODE_VERSION=$(node --version | sed 's/v//' | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ required. Current version: $(node --version)"
        exit 1
    fi

    print_success "Node.js $(node --version) detected"

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi

    print_success "npm $(npm --version) detected"
}

# Install @google/genai npm package globally
install_genai_package() {
    print_step 2 "Installing @google/genai package"

    if npm list -g @google/genai &> /dev/null; then
        print_status "@google/genai is already installed globally"
        CURRENT_VERSION=$(npm list -g @google/genai --json 2>/dev/null | grep -o '"@google/genai": "[^"]*"' | cut -d'"' -f4 || echo "unknown")
        print_status "Current version: $CURRENT_VERSION"

        read -p "Do you want to update to the latest version? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Updating @google/genai..."
            npm install -g @google/genai@latest
            print_success "@google/genai updated to latest version"
        fi
    else
        print_status "Installing @google/genai globally..."
        npm install -g @google/genai
        print_success "@google/genai installed successfully"
    fi
}

# Configure GEMINI_API_KEY environment variable
configure_api_key() {
    print_step 3 "Configuring GEMINI_API_KEY"

    if [ -n "$GEMINI_API_KEY" ]; then
        print_status "GEMINI_API_KEY is already set in environment"
        read -p "Do you want to update it? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Keeping existing API key"
            return
        fi
    fi

    echo ""
    print_status "To use Gemini AI RAG features, you need a Google AI API key."
    print_status "Get your API key from: https://makersuite.google.com/app/apikey"
    echo ""

    read -p "Enter your GEMINI_API_KEY (or press Enter to skip): " API_KEY

    if [ -z "$API_KEY" ]; then
        print_warning "API key not provided. You'll need to set GEMINI_API_KEY manually later."
        print_status "Add the following to your shell profile:"
        print_status "  export GEMINI_API_KEY='your-api-key-here'"
        return
    fi

    # Determine shell profile file
    SHELL_PROFILE=""
    if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ]; then
        SHELL_PROFILE="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ] || [ "$SHELL" = "/bin/bash" ]; then
        SHELL_PROFILE="$HOME/.bashrc"
        # Check for .bash_profile on macOS
        if [ "$OS" = "macos" ] && [ -f "$HOME/.bash_profile" ]; then
            SHELL_PROFILE="$HOME/.bash_profile"
        fi
    else
        SHELL_PROFILE="$HOME/.profile"
    fi

    # Check if already in profile
    if grep -q "GEMINI_API_KEY" "$SHELL_PROFILE" 2>/dev/null; then
        print_status "Updating existing GEMINI_API_KEY in $SHELL_PROFILE"
        # Use sed to update the existing line (different syntax for macOS vs Linux)
        if [ "$OS" = "macos" ]; then
            sed -i '' "s|export GEMINI_API_KEY=.*|export GEMINI_API_KEY='$API_KEY'|" "$SHELL_PROFILE"
        else
            sed -i "s|export GEMINI_API_KEY=.*|export GEMINI_API_KEY='$API_KEY'|" "$SHELL_PROFILE"
        fi
    else
        print_status "Adding GEMINI_API_KEY to $SHELL_PROFILE"
        echo "" >> "$SHELL_PROFILE"
        echo "# Wundr RAG - Gemini AI API Key" >> "$SHELL_PROFILE"
        echo "export GEMINI_API_KEY='$API_KEY'" >> "$SHELL_PROFILE"
    fi

    # Export for current session
    export GEMINI_API_KEY="$API_KEY"

    print_success "GEMINI_API_KEY configured successfully"
    print_status "Run 'source $SHELL_PROFILE' or restart your terminal to apply changes"
}

# Create RAG store directory structure
create_rag_directories() {
    print_step 4 "Creating RAG store directory structure"

    print_status "Creating base directory: $RAG_BASE_DIR"
    mkdir -p "$RAG_BASE_DIR"

    print_status "Creating global store: $RAG_GLOBAL_DIR"
    mkdir -p "$RAG_GLOBAL_DIR"
    mkdir -p "$RAG_GLOBAL_DIR/embeddings"
    mkdir -p "$RAG_GLOBAL_DIR/indexes"
    mkdir -p "$RAG_GLOBAL_DIR/metadata"
    mkdir -p "$RAG_GLOBAL_DIR/cache"

    print_status "Creating project-specific store: $RAG_PROJECT_DIR"
    mkdir -p "$RAG_PROJECT_DIR"

    # Create config file
    CONFIG_FILE="$RAG_BASE_DIR/config.json"
    if [ ! -f "$CONFIG_FILE" ]; then
        print_status "Creating RAG configuration file"
        cat > "$CONFIG_FILE" << 'EOF'
{
  "version": "1.0.0",
  "stores": {
    "global": {
      "path": "~/.wundr/rag-stores/global",
      "description": "Global RAG store for shared knowledge",
      "autoSync": true,
      "pruneDeleted": true
    },
    "project-specific": {
      "path": "~/.wundr/rag-stores/project-specific",
      "description": "Project-specific RAG stores",
      "autoSync": false,
      "pruneDeleted": false
    }
  },
  "embeddings": {
    "model": "text-embedding-004",
    "dimensions": 768,
    "batchSize": 100
  },
  "indexing": {
    "chunkSize": 1000,
    "chunkOverlap": 200,
    "maxTokens": 8192
  },
  "retrieval": {
    "topK": 5,
    "minScore": 0.7
  }
}
EOF
    else
        print_status "RAG configuration file already exists"
    fi

    print_success "RAG store directories created successfully"

    # Show directory structure
    echo ""
    print_status "Directory structure:"
    if command -v tree &> /dev/null; then
        tree -L 3 "$RAG_BASE_DIR"
    else
        find "$RAG_BASE_DIR" -type d | head -20
    fi
}

# Install @wundr/rag-utils (placeholder for future package)
install_rag_utils() {
    print_step 5 "Installing @wundr/rag-utils"

    # Check if package exists in local monorepo first
    LOCAL_RAG_UTILS="$PROJECT_ROOT/packages/@wundr/rag-utils"
    if [ -d "$LOCAL_RAG_UTILS" ]; then
        print_status "Found local @wundr/rag-utils package"
        cd "$LOCAL_RAG_UTILS"
        npm install
        npm run build 2>/dev/null || true
        print_success "Local @wundr/rag-utils installed"
        cd "$SCRIPT_DIR"
        return
    fi

    # Try to install from npm (placeholder - may not exist yet)
    print_status "Checking for @wundr/rag-utils on npm..."
    if npm view @wundr/rag-utils version &> /dev/null; then
        npm install -g @wundr/rag-utils
        print_success "@wundr/rag-utils installed from npm"
    else
        print_warning "@wundr/rag-utils is not yet published to npm"
        print_status "Using local utilities from scripts/rag/rag-utils.ts"

        # Ensure the local utility file will be available
        if [ -f "$SCRIPT_DIR/rag-utils.ts" ]; then
            print_success "Local rag-utils.ts is available"
        else
            print_warning "rag-utils.ts not found - please create it"
        fi
    fi
}

# Verify installation
verify_installation() {
    print_step 6 "Verifying installation"

    ERRORS=0

    # Check @google/genai
    print_status "Checking @google/genai installation..."
    if npm list -g @google/genai &> /dev/null; then
        print_success "@google/genai is installed"
    else
        print_error "@google/genai is NOT installed"
        ERRORS=$((ERRORS + 1))
    fi

    # Check GEMINI_API_KEY
    print_status "Checking GEMINI_API_KEY..."
    if [ -n "$GEMINI_API_KEY" ]; then
        # Mask the API key for display
        MASKED_KEY="${GEMINI_API_KEY:0:4}...${GEMINI_API_KEY: -4}"
        print_success "GEMINI_API_KEY is set ($MASKED_KEY)"
    else
        print_warning "GEMINI_API_KEY is NOT set (some features may not work)"
    fi

    # Check directories
    print_status "Checking RAG store directories..."
    if [ -d "$RAG_GLOBAL_DIR" ] && [ -d "$RAG_PROJECT_DIR" ]; then
        print_success "RAG store directories exist"
    else
        print_error "RAG store directories are missing"
        ERRORS=$((ERRORS + 1))
    fi

    # Check config file
    print_status "Checking RAG configuration..."
    if [ -f "$RAG_BASE_DIR/config.json" ]; then
        print_success "RAG configuration file exists"
    else
        print_error "RAG configuration file is missing"
        ERRORS=$((ERRORS + 1))
    fi

    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if [ $ERRORS -eq 0 ]; then
        print_success "RAG infrastructure setup completed successfully!"
        echo ""
        print_status "Next steps:"
        echo "  1. Source your shell profile: source ~/.zshrc (or ~/.bashrc)"
        echo "  2. Run 'wundr rag status' to check RAG status"
        echo "  3. Run 'wundr rag sync' to sync your first RAG store"
        echo ""
        print_status "Documentation:"
        echo "  - RAG stores location: $RAG_BASE_DIR"
        echo "  - Configuration file: $RAG_BASE_DIR/config.json"
    else
        print_error "Setup completed with $ERRORS error(s)"
        print_status "Please fix the errors above and run setup again"
        exit 1
    fi
}

# Main execution
main() {
    print_header

    # Parse command line arguments
    SKIP_API_KEY=false
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-api-key)
                SKIP_API_KEY=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --skip-api-key    Skip GEMINI_API_KEY configuration"
                echo "  --help, -h        Show this help message"
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done

    check_os
    check_node
    install_genai_package

    if [ "$SKIP_API_KEY" = false ]; then
        configure_api_key
    else
        print_status "Skipping API key configuration (--skip-api-key)"
    fi

    create_rag_directories
    install_rag_utils
    verify_installation
}

main "$@"
