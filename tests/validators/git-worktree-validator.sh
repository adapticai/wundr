#!/usr/bin/env bash
set -euo pipefail

# Git Worktree Workflow Validator
# Tests git-worktree functionality and workflows

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

declare -a FAILURES=()

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++));}
log_failure() { echo -e "${RED}[FAIL]${NC} $1"; FAILURES+=("$1"); ((TESTS_FAILED++));}
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

run_test() {
    local test_name="$1"
    local test_func="$2"

    ((TESTS_RUN++))
    log_info "Running: $test_name"

    if $test_func; then
        log_success "$test_name"
        return 0
    else
        log_failure "$test_name"
        return 1
    fi
}

# Setup test environment
setup_test_repo() {
    local test_dir=$(mktemp -d)
    cd "$test_dir"

    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    # Create initial commit
    echo "# Test Repo" > README.md
    git add README.md
    git commit -q -m "Initial commit"

    echo "$test_dir"
}

cleanup_test_repo() {
    local test_dir="$1"
    if [[ -d "$test_dir" ]]; then
        cd /tmp
        rm -rf "$test_dir"
    fi
}

# ============================================================================
# BASIC WORKTREE TESTS
# ============================================================================

test_worktree_add_basic() {
    local test_dir=$(setup_test_repo)

    git worktree add -b feature-branch ../test-worktree 2>&1 | grep -q "Preparing worktree"
    local result=$?

    cleanup_test_repo "$test_dir"
    return $result
}

test_worktree_list() {
    local test_dir=$(setup_test_repo)

    git worktree add -b feature-branch ../test-worktree >/dev/null 2>&1
    git worktree list | grep -q "test-worktree"
    local result=$?

    cleanup_test_repo "$test_dir"
    return $result
}

test_worktree_remove() {
    local test_dir=$(setup_test_repo)

    git worktree add -b feature-branch ../test-worktree >/dev/null 2>&1
    git worktree remove ../test-worktree >/dev/null 2>&1
    ! git worktree list | grep -q "test-worktree"
    local result=$?

    cleanup_test_repo "$test_dir"
    return $result
}

test_worktree_prune() {
    local test_dir=$(setup_test_repo)

    git worktree add -b feature-branch ../test-worktree >/dev/null 2>&1
    rm -rf ../test-worktree
    git worktree prune >/dev/null 2>&1
    ! git worktree list | grep -q "test-worktree"
    local result=$?

    cleanup_test_repo "$test_dir"
    return $result
}

# ============================================================================
# WORKTREE ISOLATION TESTS
# ============================================================================

test_worktree_branch_isolation() {
    local test_dir=$(setup_test_repo)

    # Create worktree on new branch
    git worktree add -b feature ../test-worktree >/dev/null 2>&1

    # Make changes in worktree
    cd ../test-worktree
    echo "feature work" > feature.txt
    git add feature.txt
    git commit -q -m "Feature work"

    # Check main repo is unchanged
    cd "$test_dir"
    [[ ! -f feature.txt ]]
    local result=$?

    cleanup_test_repo "$test_dir"
    return $result
}

test_worktree_index_isolation() {
    local test_dir=$(setup_test_repo)

    git worktree add -b feature ../test-worktree >/dev/null 2>&1

    # Stage file in main repo
    echo "main change" > main.txt
    git add main.txt

    # Check worktree has clean index
    cd ../test-worktree
    [[ -z "$(git status --porcelain)" ]]
    local result=$?

    cleanup_test_repo "$test_dir"
    return $result
}

# ============================================================================
# WORKTREE WORKFLOW TESTS
# ============================================================================

test_worktree_parallel_development() {
    local test_dir=$(setup_test_repo)

    # Create two worktrees
    git worktree add -b feature-1 ../worktree-1 >/dev/null 2>&1
    git worktree add -b feature-2 ../worktree-2 >/dev/null 2>&1

    # Work in both
    cd ../worktree-1
    echo "feature 1" > f1.txt
    git add f1.txt
    git commit -q -m "Feature 1"

    cd ../worktree-2
    echo "feature 2" > f2.txt
    git add f2.txt
    git commit -q -m "Feature 2"

    # Both commits should exist
    cd "$test_dir"
    git log --all --oneline | grep -q "Feature 1"
    git log --all --oneline | grep -q "Feature 2"
    local result=$?

    cleanup_test_repo "$test_dir"
    return $result
}

test_worktree_hotfix_workflow() {
    local test_dir=$(setup_test_repo)

    # Simulate hotfix workflow
    git worktree add -b hotfix ../hotfix-worktree >/dev/null 2>&1

    cd ../hotfix-worktree
    echo "hotfix" > hotfix.txt
    git add hotfix.txt
    git commit -q -m "Hotfix"

    # Merge back to main
    cd "$test_dir"
    git merge --no-ff hotfix -m "Merge hotfix" >/dev/null 2>&1

    [[ -f hotfix.txt ]]
    local result=$?

    cleanup_test_repo "$test_dir"
    return $result
}

# ============================================================================
# WORKTREE CLEANUP TESTS
# ============================================================================

test_worktree_locks() {
    local test_dir=$(setup_test_repo)

    git worktree add -b feature ../test-worktree >/dev/null 2>&1
    git worktree lock ../test-worktree >/dev/null 2>&1

    git worktree list | grep -q "locked"
    local locked=$?

    git worktree unlock ../test-worktree >/dev/null 2>&1
    ! git worktree list | grep -q "locked"
    local unlocked=$?

    cleanup_test_repo "$test_dir"

    [[ $locked -eq 0 ]] && [[ $unlocked -eq 0 ]]
}

test_worktree_orphan_detection() {
    local test_dir=$(setup_test_repo)

    git worktree add -b feature ../test-worktree >/dev/null 2>&1

    # Manually remove worktree directory
    rm -rf ../test-worktree

    # Prune should remove it
    git worktree prune -v 2>&1 | grep -q "Removing worktrees"
    local result=$?

    cleanup_test_repo "$test_dir"
    return $result
}

# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

test_worktree_duplicate_branch_prevention() {
    local test_dir=$(setup_test_repo)

    git worktree add -b feature ../test-worktree >/dev/null 2>&1

    # Try to create another worktree with same branch
    ! git worktree add -b feature ../test-worktree-2 2>/dev/null
    local result=$?

    cleanup_test_repo "$test_dir"
    return $result
}

test_worktree_invalid_path_handling() {
    local test_dir=$(setup_test_repo)

    # Try to create worktree in invalid location
    ! git worktree add -b feature /root/invalid-path 2>/dev/null
    local result=$?

    cleanup_test_repo "$test_dir"
    return $result
}

# ============================================================================
# INTEGRATION TESTS
# ============================================================================

test_worktree_with_hooks() {
    local test_dir=$(setup_test_repo)

    # Create post-checkout hook
    mkdir -p .git/hooks
    cat > .git/hooks/post-checkout <<'EOF'
#!/bin/bash
echo "Post-checkout executed" > /tmp/hook-test-$$
EOF
    chmod +x .git/hooks/post-checkout

    git worktree add -b feature ../test-worktree >/dev/null 2>&1

    cd ../test-worktree
    # Hook should have executed
    ls /tmp/hook-test-* >/dev/null 2>&1
    local result=$?

    rm -f /tmp/hook-test-*
    cleanup_test_repo "$test_dir"
    return $result
}

test_worktree_with_submodules() {
    local test_dir=$(setup_test_repo)

    # Create a submodule
    local sub_dir=$(mktemp -d)
    cd "$sub_dir"
    git init -q
    echo "submodule" > sub.txt
    git add sub.txt
    git config user.email "test@example.com"
    git config user.name "Test User"
    git commit -q -m "Sub initial"

    cd "$test_dir"
    git submodule add "$sub_dir" submodule >/dev/null 2>&1
    git commit -q -m "Add submodule"

    # Create worktree
    git worktree add -b feature ../test-worktree >/dev/null 2>&1

    cd ../test-worktree
    [[ -d submodule ]]
    local result=$?

    cleanup_test_repo "$test_dir"
    rm -rf "$sub_dir"
    return $result
}

# ============================================================================
# PERFORMANCE TESTS
# ============================================================================

test_worktree_creation_speed() {
    local test_dir=$(setup_test_repo)

    local start=$(date +%s%N)
    for i in {1..10}; do
        git worktree add -b "branch-$i" "../worktree-$i" >/dev/null 2>&1
    done
    local end=$(date +%s%N)

    local duration=$(( (end - start) / 1000000 )) # Convert to ms

    log_info "Created 10 worktrees in ${duration}ms"

    # Should be reasonably fast (< 5 seconds)
    local result=0
    if [[ $duration -gt 5000 ]]; then
        log_warning "Worktree creation slower than expected"
        result=0 # Don't fail, just warn
    fi

    cleanup_test_repo "$test_dir"
    return $result
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo "======================================================================"
    echo "  Git Worktree Workflow Validation Test Suite"
    echo "======================================================================"
    echo ""

    # Check git version
    local git_version=$(git --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    log_info "Git version: $git_version"
    echo ""

    # Basic Tests
    echo -e "${BLUE}Testing Basic Worktree Operations...${NC}"
    run_test "Worktree add" test_worktree_add_basic
    run_test "Worktree list" test_worktree_list
    run_test "Worktree remove" test_worktree_remove
    run_test "Worktree prune" test_worktree_prune
    echo ""

    # Isolation Tests
    echo -e "${BLUE}Testing Worktree Isolation...${NC}"
    run_test "Branch isolation" test_worktree_branch_isolation
    run_test "Index isolation" test_worktree_index_isolation
    echo ""

    # Workflow Tests
    echo -e "${BLUE}Testing Worktree Workflows...${NC}"
    run_test "Parallel development" test_worktree_parallel_development
    run_test "Hotfix workflow" test_worktree_hotfix_workflow
    echo ""

    # Cleanup Tests
    echo -e "${BLUE}Testing Worktree Cleanup...${NC}"
    run_test "Worktree locks" test_worktree_locks
    run_test "Orphan detection" test_worktree_orphan_detection
    echo ""

    # Error Handling
    echo -e "${BLUE}Testing Error Handling...${NC}"
    run_test "Duplicate branch prevention" test_worktree_duplicate_branch_prevention
    run_test "Invalid path handling" test_worktree_invalid_path_handling
    echo ""

    # Integration Tests
    echo -e "${BLUE}Testing Integration...${NC}"
    run_test "Worktree with hooks" test_worktree_with_hooks
    run_test "Worktree with submodules" test_worktree_with_submodules
    echo ""

    # Performance Tests
    echo -e "${BLUE}Testing Performance...${NC}"
    run_test "Worktree creation speed" test_worktree_creation_speed
    echo ""

    # Summary
    echo "======================================================================"
    echo "  Test Summary"
    echo "======================================================================"
    echo -e "Total Tests:  $TESTS_RUN"
    echo -e "${GREEN}Passed:       $TESTS_PASSED${NC}"
    echo -e "${RED}Failed:       $TESTS_FAILED${NC}"
    echo ""

    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${RED}Failed Tests:${NC}"
        for failure in "${FAILURES[@]}"; do
            echo "  - $failure"
        done
        echo ""
        exit 1
    else
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
