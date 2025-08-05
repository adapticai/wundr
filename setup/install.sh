#!/bin/bash
# Comprehensive installation script for Monorepo Refactoring Toolkit
# This script handles cross-platform installation and setup

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner
echo ""
echo "=============================================="
echo "  Monorepo Refactoring Toolkit Setup"
echo "=============================================="
echo ""

# Detect operating system
detect_os() {
    case "$(uname -s)" in
        Darwin*)    OS="macOS";;
        Linux*)     OS="Linux";;
        CYGWIN*)    OS="Windows";;
        MINGW*)     OS="Windows";;
        *)          OS="Unknown";;
    esac
    log_info "Detected OS: $OS"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
check_node() {
    log_info "Checking Node.js installation..."
    
    if ! command_exists node; then
        log_error "Node.js is not installed. Please install Node.js 18.x or later."
        log_info "Visit: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_VERSION="18.0.0"
    
    if ! command_exists npx; then
        log_error "npx is not available. Please update Node.js."
        exit 1
    fi
    
    # Simple version comparison
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
        log_error "Node.js version $NODE_VERSION is too old. Required: $REQUIRED_VERSION or later."
        exit 1
    fi
    
    log_success "Node.js $NODE_VERSION is compatible"
}

# Check npm/yarn
check_package_manager() {
    log_info "Checking package manager..."
    
    if command_exists yarn; then
        PACKAGE_MANAGER="yarn"
        log_success "Using Yarn"
    elif command_exists npm; then
        PACKAGE_MANAGER="npm"
        log_success "Using npm"
    else
        log_error "Neither npm nor yarn found. Please install Node.js properly."
        exit 1
    fi
}

# Check Git
check_git() {
    log_info "Checking Git installation..."
    
    if ! command_exists git; then
        log_error "Git is not installed. Please install Git."
        exit 1
    fi
    
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    log_success "Git $GIT_VERSION is available"
}

# Check Python (optional)
check_python() {
    log_info "Checking Python installation (optional)..."
    
    if command_exists python3; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        log_success "Python $PYTHON_VERSION is available"
        HAS_PYTHON=true
    elif command_exists python; then
        PYTHON_VERSION=$(python --version 2>&1 | cut -d' ' -f2)
        if [[ $PYTHON_VERSION == 3* ]]; then
            log_success "Python $PYTHON_VERSION is available"
            HAS_PYTHON=true
        else
            log_warning "Python 2.x detected. Python 3.x recommended for some features."
            HAS_PYTHON=false
        fi
    else
        log_warning "Python not found. Some analysis features may be limited."
        HAS_PYTHON=false
    fi
}

# Install Node.js dependencies
install_dependencies() {
    log_info "Installing Node.js dependencies..."
    
    if [ "$PACKAGE_MANAGER" = "yarn" ]; then
        yarn install --frozen-lockfile
    else
        npm ci
    fi
    
    log_success "Node.js dependencies installed"
}

# Install Python dependencies
install_python_dependencies() {
    if [ "$HAS_PYTHON" = true ] && [ -f "setup/requirements.txt" ]; then
        log_info "Installing Python dependencies..."
        
        if command_exists pip3; then
            pip3 install -r setup/requirements.txt
        elif command_exists pip; then
            pip install -r setup/requirements.txt
        else
            log_warning "pip not found. Skipping Python dependencies."
            return
        fi
        
        log_success "Python dependencies installed"
    fi
}

# Setup git hooks
setup_git_hooks() {
    log_info "Setting up Git hooks..."
    
    if [ ! -d ".git" ]; then
        log_warning "Not a Git repository. Skipping Git hooks setup."
        return
    fi
    
    # Copy pre-commit hook
    if [ -f "config/git/hooks/pre-commit" ]; then
        cp "config/git/hooks/pre-commit" ".git/hooks/pre-commit"
        chmod +x ".git/hooks/pre-commit"
        log_success "Pre-commit hook installed"
    fi
    
    # Install husky if available
    if [ "$PACKAGE_MANAGER" = "yarn" ]; then
        if yarn list husky >/dev/null 2>&1; then
            yarn husky install
        fi
    else
        if npm list husky >/dev/null 2>&1; then
            npx husky install
        fi
    fi
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    mkdir -p logs
    mkdir -p temp
    mkdir -p output/reports
    mkdir -p output/analysis
    
    log_success "Directories created"
}

# Build TypeScript files
build_typescript() {
    log_info "Building TypeScript files..."
    
    if [ -f "tsconfig.json" ]; then
        if [ "$PACKAGE_MANAGER" = "yarn" ]; then
            yarn build
        else
            npm run build
        fi
        log_success "TypeScript files built"
    else
        log_warning "No tsconfig.json found. Skipping build."
    fi
}

# Run verification
run_verification() {
    log_info "Running setup verification..."
    
    if [ -f "setup/verify-setup.sh" ]; then
        bash setup/verify-setup.sh
    else
        log_warning "Verification script not found. Please run manually later."
    fi
}

# Main installation process
main() {
    detect_os
    
    log_info "Starting installation process..."
    
    # Prerequisites check
    check_node
    check_package_manager
    check_git
    check_python
    
    # Installation
    install_dependencies
    install_python_dependencies
    create_directories
    setup_git_hooks
    build_typescript
    
    # Verification
    run_verification
    
    echo ""
    log_success "Installation completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Review the documentation in docs/"
    echo "  2. Try the quick start guide: docs/guides/QUICK_START.md"
    echo "  3. Run verification: bash setup/verify-setup.sh"
    echo ""
    echo "For help, see: https://github.com/yourusername/monorepo-refactoring-toolkit"
    echo ""
}

# Run main function
main "$@"
