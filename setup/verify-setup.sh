#!/bin/bash
# Comprehensive setup verification script for Monorepo Refactoring Toolkit
# This script verifies that all components are properly installed and configured

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

# Test function wrapper
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    if eval "$test_command" >/dev/null 2>&1; then
        log_success "$test_name"
        return 0
    else
        log_error "$test_name"
        return 1
    fi
}

# Test function with custom validation
run_test_with_validation() {
    local test_name="$1"
    local test_command="$2"
    local validation_command="$3"
    
    if eval "$test_command" >/dev/null 2>&1 && eval "$validation_command" >/dev/null 2>&1; then
        log_success "$test_name"
        return 0
    else
        log_error "$test_name"
        return 1
    fi
}

echo ""
echo "=============================================="
echo "  Monorepo Refactoring Toolkit Verification"
echo "=============================================="
echo ""

# Check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# System Prerequisites
log_info "Checking system prerequisites..."

run_test "Node.js is installed" "command_exists node"
if command_exists node; then
    NODE_VERSION=$(node -v)
    log_info "Node.js version: $NODE_VERSION"
fi

run_test "npm is installed" "command_exists npm"
if command_exists npm; then
    NPM_VERSION=$(npm -v)
    log_info "npm version: $NPM_VERSION"
fi

if command_exists yarn; then
    YARN_VERSION=$(yarn -v)
    log_info "Yarn version: $YARN_VERSION"
fi

run_test "Git is installed" "command_exists git"
if command_exists git; then
    GIT_VERSION=$(git --version)
    log_info "$GIT_VERSION"
fi

echo ""

# Project Structure
log_info "Checking project structure..."

run_test "Root package.json exists" "test -f package.json"
run_test "TypeScript config exists" "test -f tsconfig.json"
run_test "Setup directory exists" "test -d setup"
run_test "Scripts directory exists" "test -d scripts"
run_test "Config directory exists" "test -d config"
run_test "Docs directory exists" "test -d docs"
run_test "Examples directory exists" "test -d examples"
run_test "Templates directory exists" "test -d templates"

echo ""

# Configuration Files
log_info "Checking configuration files..."

run_test "Setup package.json exists" "test -f setup/package.json"
run_test "ESLint config exists" "test -f .eslintrc.js || test -f .eslintrc.json || test -f eslint.config.js"
run_test "Prettier config exists" "test -f .prettierrc || test -f .prettierrc.json || test -f .prettierrc.js"
run_test "Git hooks directory exists" "test -d config/git/hooks"
run_test "Pre-commit hook exists" "test -f config/git/hooks/pre-commit"

if [ -f ".nvmrc" ]; then
    log_success "Node version file (.nvmrc) exists"
else
    log_warning "Node version file (.nvmrc) not found"
fi

echo ""

# Dependencies
log_info "Checking Node.js dependencies..."

if [ -f "package.json" ]; then
    if [ -d "node_modules" ]; then
        log_success "node_modules directory exists"
        
        # Check critical dependencies
        run_test "TypeScript is installed" "test -d node_modules/typescript || npm list typescript"
        run_test "ESLint is installed" "test -d node_modules/eslint || npm list eslint"
        run_test "Prettier is installed" "test -d node_modules/prettier || npm list prettier"
        
        # Check for common dev dependencies
        if npm list husky >/dev/null 2>&1; then
            log_success "Husky is installed (Git hooks manager)"
        else
            log_warning "Husky not found - Git hooks may need manual setup"
        fi
        
        if npm list jest >/dev/null 2>&1 || npm list vitest >/dev/null 2>&1; then
            log_success "Testing framework is installed"
        else
            log_warning "No testing framework detected"
        fi
        
    else
        log_error "node_modules directory not found - run npm install"
    fi
else
    log_error "package.json not found"
fi

echo ""

# Python Dependencies (if applicable)
if command_exists python3 || command_exists python; then
    log_info "Checking Python dependencies..."
    
    if [ -f "setup/requirements.txt" ]; then
        log_success "Python requirements file exists"
        
        # Check if requirements are installed
        if command_exists pip3; then
            PIP_CMD="pip3"
        elif command_exists pip; then
            PIP_CMD="pip"
        else
            log_warning "pip not found - cannot verify Python dependencies"
            PIP_CMD=""
        fi
        
        if [ -n "$PIP_CMD" ]; then
            # Check a few common dependencies that might be in requirements.txt
            while IFS= read -r requirement; do
                if [ -n "$requirement" ] && [[ ! "$requirement" == \#* ]]; then
                    package_name=$(echo "$requirement" | cut -d'=' -f1 | cut -d'>' -f1 | cut -d'<' -f1)
                    if [ -n "$package_name" ]; then
                        if $PIP_CMD show "$package_name" >/dev/null 2>&1; then
                            log_success "Python package '$package_name' is installed"
                        else
                            log_warning "Python package '$package_name' not found"
                        fi
                    fi
                fi
            done < "setup/requirements.txt"
        fi
    else
        log_warning "Python requirements file not found"
    fi
fi

echo ""

# Git Configuration
log_info "Checking Git configuration..."

if [ -d ".git" ]; then
    log_success "Git repository is initialized"
    
    # Check if hooks are installed
    if [ -f ".git/hooks/pre-commit" ]; then
        log_success "Pre-commit hook is installed"
        if [ -x ".git/hooks/pre-commit" ]; then
            log_success "Pre-commit hook is executable"
        else
            log_warning "Pre-commit hook is not executable"
        fi
    else
        log_warning "Pre-commit hook not installed in .git/hooks/"
    fi
    
    # Check if husky is configured
    if [ -d ".husky" ]; then
        log_success "Husky is configured"
    fi
    
else
    log_warning "Not a Git repository"
fi

echo ""

# Script Permissions
log_info "Checking script permissions..."

for script in setup/install.sh setup/verify-setup.sh; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            log_success "$script is executable"
        else
            log_warning "$script is not executable (run: chmod +x $script)"
        fi
    fi
done

# Check scripts directory
if [ -d "scripts" ]; then
    for script_file in scripts/**/*.sh; do
        if [ -f "$script_file" ]; then
            if [ -x "$script_file" ]; then
                log_success "$(basename "$script_file") is executable"
            else
                log_warning "$(basename "$script_file") is not executable"
            fi
        fi
    done
fi

echo ""

# TypeScript Compilation
log_info "Checking TypeScript compilation..."

if [ -f "tsconfig.json" ] && command_exists npx; then
    if npx tsc --noEmit >/dev/null 2>&1; then
        log_success "TypeScript compilation check passed"
    else
        log_error "TypeScript compilation errors found"
    fi
else
    log_warning "Cannot check TypeScript compilation"
fi

echo ""

# Linting
log_info "Checking code quality tools..."

if command_exists npx && ([ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f "eslint.config.js" ]); then
    if npx eslint --version >/dev/null 2>&1; then
        log_success "ESLint is working"
    else
        log_error "ESLint is not working properly"
    fi
else
    log_warning "ESLint configuration not found or not working"
fi

if command_exists npx && ([ -f ".prettierrc" ] || [ -f ".prettierrc.json" ] || [ -f ".prettierrc.js" ]); then
    if npx prettier --version >/dev/null 2>&1; then
        log_success "Prettier is working"
    else
        log_error "Prettier is not working properly"
    fi
else
    log_warning "Prettier configuration not found or not working"
fi

echo ""

# Directory Structure Test
log_info "Checking required directories..."

required_dirs=("logs" "temp" "output/reports" "output/analysis")
for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        log_success "Directory '$dir' exists"
    else
        log_warning "Directory '$dir' not found (will be created automatically)"
    fi
done

echo ""

# Final Summary
echo "=============================================="
echo "  Verification Summary"
echo "=============================================="
echo ""
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN} Setup verification completed successfully!${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}  There are $WARNINGS warnings that should be addressed.${NC}"
    fi
    echo ""
    echo "Your Monorepo Refactoring Toolkit is ready to use!"
    echo ""
    echo "Next steps:"
    echo "  " Read the quick start guide: docs/guides/QUICK_START.md"
    echo "  " Explore the examples: examples/"
    echo "  " Try the analysis tools: scripts/analysis/"
    echo ""
    exit 0
else
    echo -e "${RED} Setup verification failed with $TESTS_FAILED errors.${NC}"
    echo ""
    echo "Please fix the errors above and run this script again."
    echo ""
    exit 1
fi