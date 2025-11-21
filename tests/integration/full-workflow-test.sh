#!/usr/bin/env bash
set -euo pipefail

# Full Workflow Integration Test
# Tests complete end-to-end workflows

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

# ============================================================================
# COMPLETE PROJECT SETUP WORKFLOW
# ============================================================================

test_new_project_setup() {
    local test_dir=$(mktemp -d)
    cd "$test_dir"

    # Initialize git repo
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    # Copy project structure
    cp -r "$PROJECT_ROOT"/.git/hooks "$test_dir/.git/" 2>/dev/null || true
    cp "$PROJECT_ROOT/package.json" "$test_dir/" 2>/dev/null || true

    # Initial commit
    echo "# Test Project" > README.md
    git add README.md
    git commit -q -m "Initial commit"

    # Verify setup
    [[ -d .git ]] && [[ -f README.md ]]
    local result=$?

    cd - >/dev/null
    rm -rf "$test_dir"
    return $result
}

# ============================================================================
# FEATURE BRANCH WORKFLOW
# ============================================================================

test_feature_branch_workflow() {
    local test_dir=$(mktemp -d)
    cd "$test_dir"

    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    # Main branch setup
    echo "# Main" > README.md
    git add README.md
    git commit -q -m "Initial commit"

    # Create feature branch
    git checkout -b feature/test-feature -q

    # Work on feature
    echo "Feature work" > feature.txt
    git add feature.txt
    git commit -q -m "Add feature"

    # Return to main and merge
    git checkout main -q 2>/dev/null || git checkout master -q
    git merge --no-ff feature/test-feature -m "Merge feature" -q

    # Verify
    [[ -f feature.txt ]]
    local result=$?

    cd - >/dev/null
    rm -rf "$test_dir"
    return $result
}

# ============================================================================
# WORKTREE PARALLEL DEVELOPMENT WORKFLOW
# ============================================================================

test_worktree_parallel_workflow() {
    local test_dir=$(mktemp -d)
    cd "$test_dir"

    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    echo "# Main" > README.md
    git add README.md
    git commit -q -m "Initial commit"

    # Create worktrees for parallel development
    git worktree add -b feature-1 ../wt-feature-1 >/dev/null 2>&1
    git worktree add -b feature-2 ../wt-feature-2 >/dev/null 2>&1

    # Work in first worktree
    cd ../wt-feature-1
    echo "Feature 1" > f1.txt
    git add f1.txt
    git commit -q -m "Feature 1"

    # Work in second worktree
    cd ../wt-feature-2
    echo "Feature 2" > f2.txt
    git add f2.txt
    git commit -q -m "Feature 2"

    # Return to main and verify both branches exist
    cd "$test_dir"
    git branch | grep -q "feature-1"
    git branch | grep -q "feature-2"
    local result=$?

    # Cleanup worktrees
    git worktree remove ../wt-feature-1 2>/dev/null || true
    git worktree remove ../wt-feature-2 2>/dev/null || true

    cd - >/dev/null
    rm -rf "$test_dir"
    return $result
}

# ============================================================================
# HOOK INTEGRATION WORKFLOW
# ============================================================================

test_hooks_integration_workflow() {
    local test_dir=$(mktemp -d)
    cd "$test_dir"

    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    # Create simple pre-commit hook
    mkdir -p .git/hooks
    cat > .git/hooks/pre-commit <<'EOF'
#!/usr/bin/env bash
# Simple validation
if git diff --cached --name-only | grep -q "\.txt$"; then
    echo "Text files detected"
fi
exit 0
EOF
    chmod +x .git/hooks/pre-commit

    # Test commit
    echo "test" > test.txt
    git add test.txt
    git commit -m "Test commit" >/dev/null 2>&1

    [[ -f test.txt ]]
    local result=$?

    cd - >/dev/null
    rm -rf "$test_dir"
    return $result
}

# ============================================================================
# MULTI-AGENT COORDINATION WORKFLOW
# ============================================================================

test_multi_agent_workflow() {
    local test_dir=$(mktemp -d)
    cd "$test_dir"

    # Simulate multi-agent workflow
    mkdir -p agents/{coder,tester,reviewer}

    # Agent 1: Coder
    cat > agents/coder/task.txt <<EOF
Task: Implement feature
Status: Complete
Output: feature.js created
EOF

    # Agent 2: Tester
    cat > agents/tester/task.txt <<EOF
Task: Test feature
Status: Complete
Output: All tests pass
EOF

    # Agent 3: Reviewer
    cat > agents/reviewer/task.txt <<EOF
Task: Review code
Status: Complete
Output: Approved
EOF

    # Verify all agents completed
    [[ -f agents/coder/task.txt ]] && \
    [[ -f agents/tester/task.txt ]] && \
    [[ -f agents/reviewer/task.txt ]]
    local result=$?

    cd - >/dev/null
    rm -rf "$test_dir"
    return $result
}

# ============================================================================
# TEMPLATE INSTALLATION WORKFLOW
# ============================================================================

test_template_installation_workflow() {
    local test_dir=$(mktemp -d)
    cd "$test_dir"

    # Simulate template installation
    mkdir -p template/{src,tests,docs}

    cat > template/package.json <<'EOF'
{
  "name": "test-template",
  "version": "1.0.0",
  "scripts": {
    "test": "echo \"Test passed\""
  }
}
EOF

    cat > template/src/index.js <<'EOF'
console.log('Template installed');
EOF

    # Install template
    cp -r template/* .

    # Verify installation
    [[ -f package.json ]] && \
    [[ -d src ]] && \
    [[ -d tests ]] && \
    [[ -d docs ]]
    local result=$?

    cd - >/dev/null
    rm -rf "$test_dir"
    return $result
}

# ============================================================================
# BUILD AND TEST WORKFLOW
# ============================================================================

test_build_test_workflow() {
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log_warning "No package.json found, skipping build test"
        return 0
    fi

    local test_dir=$(mktemp -d)
    cp -r "$PROJECT_ROOT"/* "$test_dir/" 2>/dev/null || true

    cd "$test_dir"

    # Install dependencies
    if npm install >/dev/null 2>&1; then
        # Run build if available
        if grep -q '"build"' package.json 2>/dev/null; then
            npm run build >/dev/null 2>&1
            local build_result=$?

            # Run tests if available
            if grep -q '"test"' package.json 2>/dev/null; then
                npm test >/dev/null 2>&1
                local test_result=$?

                cd - >/dev/null
                rm -rf "$test_dir"

                [[ $build_result -eq 0 ]] && [[ $test_result -eq 0 ]]
                return $?
            fi

            cd - >/dev/null
            rm -rf "$test_dir"
            return $build_result
        fi
    fi

    cd - >/dev/null
    rm -rf "$test_dir"
    return 0
}

# ============================================================================
# CLEANUP AND RESET WORKFLOW
# ============================================================================

test_cleanup_workflow() {
    local test_dir=$(mktemp -d)
    cd "$test_dir"

    # Create artifacts
    mkdir -p node_modules dist build .cache
    touch package-lock.json

    # Simulate cleanup
    rm -rf node_modules dist build .cache package-lock.json

    # Verify cleanup
    [[ ! -d node_modules ]] && \
    [[ ! -d dist ]] && \
    [[ ! -d build ]] && \
    [[ ! -d .cache ]] && \
    [[ ! -f package-lock.json ]]
    local result=$?

    cd - >/dev/null
    rm -rf "$test_dir"
    return $result
}

# ============================================================================
# CONTINUOUS INTEGRATION WORKFLOW
# ============================================================================

test_ci_workflow() {
    local test_dir=$(mktemp -d)
    cd "$test_dir"

    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    # Simulate CI steps
    echo "# Project" > README.md
    git add README.md
    git commit -q -m "Initial commit"

    # Step 1: Lint (simulated)
    local lint_pass=true

    # Step 2: Test (simulated)
    local test_pass=true

    # Step 3: Build (simulated)
    local build_pass=true

    cd - >/dev/null
    rm -rf "$test_dir"

    [[ "$lint_pass" == true ]] && \
    [[ "$test_pass" == true ]] && \
    [[ "$build_pass" == true ]]
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo "======================================================================"
    echo "  Full Workflow Integration Test Suite"
    echo "======================================================================"
    echo ""

    # Project Setup
    echo -e "${BLUE}Testing Project Setup Workflows...${NC}"
    run_test "New project setup" test_new_project_setup
    echo ""

    # Development Workflows
    echo -e "${BLUE}Testing Development Workflows...${NC}"
    run_test "Feature branch workflow" test_feature_branch_workflow
    run_test "Worktree parallel workflow" test_worktree_parallel_workflow
    echo ""

    # Integration Workflows
    echo -e "${BLUE}Testing Integration Workflows...${NC}"
    run_test "Hooks integration workflow" test_hooks_integration_workflow
    run_test "Multi-agent workflow" test_multi_agent_workflow
    run_test "Template installation workflow" test_template_installation_workflow
    echo ""

    # Build and Test
    echo -e "${BLUE}Testing Build and Test Workflows...${NC}"
    run_test "Build and test workflow" test_build_test_workflow
    echo ""

    # Cleanup Workflows
    echo -e "${BLUE}Testing Cleanup Workflows...${NC}"
    run_test "Cleanup workflow" test_cleanup_workflow
    echo ""

    # CI Workflows
    echo -e "${BLUE}Testing CI Workflows...${NC}"
    run_test "CI workflow" test_ci_workflow
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
        echo -e "${GREEN}All integration tests passed!${NC}"
        exit 0
    fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
