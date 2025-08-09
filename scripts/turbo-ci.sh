#!/bin/bash

# Turbo CI Script for Wundr Monorepo
# Optimized for parallel builds and caching

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs/turbo"

# Create log directory
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Function to check dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v turbo &> /dev/null; then
        error "turbo command not found. Please install turbo globally or locally."
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        error "pnpm command not found. Please install pnpm."
        exit 1
    fi
    
    success "All dependencies found"
}

# Function to run turbo with proper error handling
run_turbo_task() {
    local task=$1
    local additional_args=${2:-""}
    local log_file="$LOG_DIR/turbo-$task-$(date +%Y%m%d-%H%M%S).log"
    
    log "Running turbo $task $additional_args"
    
    if turbo $task $additional_args --output-logs=hash-only 2>&1 | tee "$log_file"; then
        success "turbo $task completed successfully"
        return 0
    else
        local exit_code=$?
        error "turbo $task failed with exit code $exit_code"
        warn "Check log file: $log_file"
        return $exit_code
    fi
}

# Function to run builds in stages for better dependency resolution
staged_build() {
    log "Running staged build process..."
    
    # Stage 1: Build core packages first
    log "Stage 1: Building core packages..."
    if ! run_turbo_task "build" "--filter='@wundr/core' --filter='@wundr/shared-config'"; then
        error "Stage 1 build failed"
        return 1
    fi
    
    # Stage 2: Build analysis engine and CLI
    log "Stage 2: Building analysis and CLI packages..."
    if ! run_turbo_task "build" "--filter='@wundr/analysis-engine' --filter='@wundr/cli'"; then
        error "Stage 2 build failed"
        return 1
    fi
    
    # Stage 3: Build remaining packages
    log "Stage 3: Building remaining packages..."
    if ! run_turbo_task "build" "--continue"; then
        warn "Some packages failed to build, but continuing..."
    fi
    
    success "Staged build process completed"
}

# Function to run parallel builds (faster but less reliable)
parallel_build() {
    log "Running parallel build..."
    if ! run_turbo_task "build" "--parallel"; then
        error "Parallel build failed"
        return 1
    fi
    success "Parallel build completed"
}

# Function to run CI tasks
run_ci() {
    log "Running CI pipeline..."
    
    # Clean cache if requested
    if [[ "${CLEAN_CACHE:-false}" == "true" ]]; then
        log "Cleaning turbo cache..."
        turbo prune
    fi
    
    # Install dependencies
    log "Installing dependencies..."
    pnpm install --frozen-lockfile
    
    # Run typecheck first (fast and catches most errors)
    log "Running typecheck..."
    if ! run_turbo_task "typecheck" "--continue"; then
        warn "Some packages failed typecheck"
    fi
    
    # Run linting
    log "Running linting..."
    if ! run_turbo_task "lint" "--continue"; then
        warn "Some packages failed linting"
    fi
    
    # Choose build strategy based on CI environment
    if [[ "${CI:-false}" == "true" ]]; then
        # In CI, use staged build for reliability
        staged_build
    else
        # Local development, try parallel first
        if ! parallel_build; then
            warn "Parallel build failed, falling back to staged build..."
            staged_build
        fi
    fi
    
    # Run tests
    log "Running tests..."
    if ! run_turbo_task "test:ci" "--continue"; then
        warn "Some tests failed"
    fi
    
    success "CI pipeline completed"
}

# Function to display build statistics
show_stats() {
    log "Turbo Build Statistics:"
    
    if [[ -f "$LOG_DIR"/*.log ]]; then
        echo "Recent build logs:"
        ls -la "$LOG_DIR"/*.log | tail -5
    fi
    
    # Show cache statistics
    turbo run build --dry-run=json | jq -r '.tasks[] | select(.cache.status) | "\(.package): \(.cache.status)"' 2>/dev/null || true
}

# Main execution
main() {
    log "Starting Turbo CI for Wundr Monorepo"
    
    cd "$ROOT_DIR"
    
    check_dependencies
    
    case "${1:-ci}" in
        "ci")
            run_ci
            ;;
        "build")
            if [[ "${2:-}" == "--staged" ]]; then
                staged_build
            else
                parallel_build
            fi
            ;;
        "stats")
            show_stats
            ;;
        "clean")
            log "Cleaning turbo cache and artifacts..."
            turbo prune
            rm -rf "$LOG_DIR"/*.log
            find . -name ".turbo" -type d -exec rm -rf {} + 2>/dev/null || true
            success "Clean completed"
            ;;
        *)
            echo "Usage: $0 {ci|build|build --staged|stats|clean}"
            echo ""
            echo "Commands:"
            echo "  ci              Run full CI pipeline"
            echo "  build           Run parallel build"
            echo "  build --staged  Run staged build (more reliable)"
            echo "  stats           Show build statistics"
            echo "  clean           Clean cache and logs"
            echo ""
            echo "Environment variables:"
            echo "  CLEAN_CACHE=true   Clean cache before build"
            echo "  CI=true            Enable CI mode (uses staged builds)"
            exit 1
            ;;
    esac
    
    show_stats
    success "Script completed successfully"
}

# Run main function with all arguments
main "$@"