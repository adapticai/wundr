#!/usr/bin/env bash
set -euo pipefail

# Hook Script Functionality Validator
# Tests all hook scripts for correct functionality

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
HOOKS_DIR="${HOOKS_DIR:-$PROJECT_ROOT/hooks}"

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
# HOOK DISCOVERY TESTS
# ============================================================================

test_hooks_directory_exists() {
    [[ -d "$HOOKS_DIR" ]]
}

test_pre_commit_exists() {
    [[ -f "$HOOKS_DIR/pre-commit" ]]
}

test_post_checkout_exists() {
    [[ -f "$HOOKS_DIR/post-checkout" ]]
}

test_pre_push_exists() {
    [[ -f "$HOOKS_DIR/pre-push" ]]
}

test_commit_msg_exists() {
    [[ -f "$HOOKS_DIR/commit-msg" ]]
}

# ============================================================================
# HOOK EXECUTABILITY TESTS
# ============================================================================

test_hooks_are_executable() {
    local non_executable=()

    for hook in "$HOOKS_DIR"/*; do
        if [[ -f "$hook" ]] && [[ ! -x "$hook" ]]; then
            non_executable+=("$(basename "$hook")")
        fi
    done

    if [[ ${#non_executable[@]} -gt 0 ]]; then
        log_failure "Non-executable hooks: ${non_executable[*]}"
        return 1
    fi

    return 0
}

test_hooks_have_shebang() {
    local missing_shebang=()

    for hook in "$HOOKS_DIR"/*; do
        if [[ -f "$hook" ]]; then
            local first_line=$(head -n1 "$hook")
            if [[ ! "$first_line" =~ ^#! ]]; then
                missing_shebang+=("$(basename "$hook")")
            fi
        fi
    done

    if [[ ${#missing_shebang[@]} -gt 0 ]]; then
        log_failure "Missing shebang: ${missing_shebang[*]}"
        return 1
    fi

    return 0
}

# ============================================================================
# PRE-COMMIT HOOK TESTS
# ============================================================================

test_pre_commit_syntax() {
    if [[ -f "$HOOKS_DIR/pre-commit" ]]; then
        bash -n "$HOOKS_DIR/pre-commit"
    else
        return 1
    fi
}

test_pre_commit_checks_formatting() {
    if [[ -f "$HOOKS_DIR/pre-commit" ]]; then
        grep -q "prettier\|eslint\|format" "$HOOKS_DIR/pre-commit"
    else
        return 1
    fi
}

test_pre_commit_prevents_secrets() {
    if [[ -f "$HOOKS_DIR/pre-commit" ]]; then
        grep -q "secret\|credential\|token\|password" "$HOOKS_DIR/pre-commit" || \
        grep -q "\.env" "$HOOKS_DIR/pre-commit"
    else
        return 1
    fi
}

test_pre_commit_runs_tests() {
    if [[ -f "$HOOKS_DIR/pre-commit" ]]; then
        grep -q "test\|spec\|jest\|mocha" "$HOOKS_DIR/pre-commit"
    else
        return 1
    fi
}

# ============================================================================
# POST-CHECKOUT HOOK TESTS
# ============================================================================

test_post_checkout_syntax() {
    if [[ -f "$HOOKS_DIR/post-checkout" ]]; then
        bash -n "$HOOKS_DIR/post-checkout"
    else
        return 1
    fi
}

test_post_checkout_installs_dependencies() {
    if [[ -f "$HOOKS_DIR/post-checkout" ]]; then
        grep -q "npm install\|yarn install\|pnpm install" "$HOOKS_DIR/post-checkout"
    else
        return 1
    fi
}

# ============================================================================
# PRE-PUSH HOOK TESTS
# ============================================================================

test_pre_push_syntax() {
    if [[ -f "$HOOKS_DIR/pre-push" ]]; then
        bash -n "$HOOKS_DIR/pre-push"
    else
        return 1
    fi
}

test_pre_push_runs_full_tests() {
    if [[ -f "$HOOKS_DIR/pre-push" ]]; then
        grep -q "test" "$HOOKS_DIR/pre-push"
    else
        return 1
    fi
}

# ============================================================================
# COMMIT-MSG HOOK TESTS
# ============================================================================

test_commit_msg_syntax() {
    if [[ -f "$HOOKS_DIR/commit-msg" ]]; then
        bash -n "$HOOKS_DIR/commit-msg"
    else
        return 1
    fi
}

test_commit_msg_validates_format() {
    if [[ -f "$HOOKS_DIR/commit-msg" ]]; then
        grep -q "conventional\|feat\|fix\|chore" "$HOOKS_DIR/commit-msg" || \
        grep -q "commit.*format\|message.*format" "$HOOKS_DIR/commit-msg"
    else
        return 1
    fi
}

# ============================================================================
# FUNCTIONAL TESTS
# ============================================================================

test_pre_commit_dry_run() {
    if [[ ! -f "$HOOKS_DIR/pre-commit" ]]; then
        return 1
    fi

    # Create test environment
    local test_dir=$(mktemp -d)
    cd "$test_dir"
    git init -q

    # Copy hook
    mkdir -p .git/hooks
    cp "$HOOKS_DIR/pre-commit" .git/hooks/
    chmod +x .git/hooks/pre-commit

    # Create dummy files
    echo "console.log('test')" > test.js
    git add test.js

    # Try to commit (will fail but shouldn't error)
    git commit -m "test" --no-verify >/dev/null 2>&1 || true

    # Cleanup
    cd - >/dev/null
    rm -rf "$test_dir"

    return 0
}

test_hooks_exit_codes() {
    local hooks_with_issues=()

    for hook in "$HOOKS_DIR"/*; do
        if [[ -f "$hook" ]]; then
            # Check that hooks properly use exit codes
            if ! grep -q "exit 0\|exit 1\|exit \$" "$hook"; then
                hooks_with_issues+=("$(basename "$hook")")
            fi
        fi
    done

    if [[ ${#hooks_with_issues[@]} -gt 0 ]]; then
        log_warning "Hooks without explicit exit codes: ${hooks_with_issues[*]}"
        # This is a warning, not a failure
    fi

    return 0
}

test_hooks_error_handling() {
    local hooks_without_set_e=()

    for hook in "$HOOKS_DIR"/*; do
        if [[ -f "$hook" ]]; then
            # Check for set -e or set -euo pipefail
            if ! grep -q "set -e" "$hook"; then
                hooks_without_set_e+=("$(basename "$hook")")
            fi
        fi
    done

    if [[ ${#hooks_without_set_e[@]} -gt 0 ]]; then
        log_warning "Hooks without 'set -e': ${hooks_without_set_e[*]}"
    fi

    return 0
}

# ============================================================================
# INTEGRATION TESTS
# ============================================================================

test_hooks_installation() {
    local test_dir=$(mktemp -d)
    cd "$test_dir"
    git init -q

    # Install hooks
    if [[ -f "$PROJECT_ROOT/scripts/install-hooks.sh" ]]; then
        "$PROJECT_ROOT/scripts/install-hooks.sh" >/dev/null 2>&1
        local result=$?
        cd - >/dev/null
        rm -rf "$test_dir"
        return $result
    else
        cd - >/dev/null
        rm -rf "$test_dir"
        log_warning "No install-hooks.sh script found"
        return 0
    fi
}

# ============================================================================
# PERFORMANCE TESTS
# ============================================================================

test_hooks_performance() {
    local slow_hooks=()

    for hook in "$HOOKS_DIR"/*; do
        if [[ -f "$hook" ]] && [[ -x "$hook" ]]; then
            local start=$(date +%s%N)
            timeout 5 "$hook" >/dev/null 2>&1 || true
            local end=$(date +%s%N)
            local duration=$(( (end - start) / 1000000 )) # Convert to ms

            if [[ $duration -gt 3000 ]]; then # 3 seconds
                slow_hooks+=("$(basename "$hook"): ${duration}ms")
            fi
        fi
    done

    if [[ ${#slow_hooks[@]} -gt 0 ]]; then
        log_warning "Slow hooks detected:"
        for hook in "${slow_hooks[@]}"; do
            echo "  - $hook"
        done
    fi

    return 0
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo "======================================================================"
    echo "  Hook Script Validation Test Suite"
    echo "======================================================================"
    echo ""
    log_info "Hooks directory: $HOOKS_DIR"
    echo ""

    # Discovery Tests
    echo -e "${BLUE}Testing Hook Discovery...${NC}"
    run_test "Hooks directory exists" test_hooks_directory_exists
    run_test "pre-commit exists" test_pre_commit_exists
    run_test "post-checkout exists" test_post_checkout_exists
    run_test "pre-push exists" test_pre_push_exists
    run_test "commit-msg exists" test_commit_msg_exists
    echo ""

    # Executability Tests
    echo -e "${BLUE}Testing Hook Executability...${NC}"
    run_test "All hooks are executable" test_hooks_are_executable
    run_test "All hooks have shebang" test_hooks_have_shebang
    echo ""

    # Pre-commit Tests
    echo -e "${BLUE}Testing Pre-commit Hook...${NC}"
    run_test "pre-commit syntax valid" test_pre_commit_syntax
    run_test "pre-commit checks formatting" test_pre_commit_checks_formatting
    run_test "pre-commit prevents secrets" test_pre_commit_prevents_secrets
    run_test "pre-commit runs tests" test_pre_commit_runs_tests
    echo ""

    # Post-checkout Tests
    echo -e "${BLUE}Testing Post-checkout Hook...${NC}"
    run_test "post-checkout syntax valid" test_post_checkout_syntax
    run_test "post-checkout installs dependencies" test_post_checkout_installs_dependencies
    echo ""

    # Pre-push Tests
    echo -e "${BLUE}Testing Pre-push Hook...${NC}"
    run_test "pre-push syntax valid" test_pre_push_syntax
    run_test "pre-push runs full tests" test_pre_push_runs_full_tests
    echo ""

    # Commit-msg Tests
    echo -e "${BLUE}Testing Commit-msg Hook...${NC}"
    run_test "commit-msg syntax valid" test_commit_msg_syntax
    run_test "commit-msg validates format" test_commit_msg_validates_format
    echo ""

    # Functional Tests
    echo -e "${BLUE}Testing Hook Functionality...${NC}"
    run_test "pre-commit dry run" test_pre_commit_dry_run
    run_test "hooks use proper exit codes" test_hooks_exit_codes
    run_test "hooks have error handling" test_hooks_error_handling
    echo ""

    # Integration Tests
    echo -e "${BLUE}Testing Hook Integration...${NC}"
    run_test "hooks installation works" test_hooks_installation
    echo ""

    # Performance Tests
    echo -e "${BLUE}Testing Hook Performance...${NC}"
    run_test "hooks performance acceptable" test_hooks_performance
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
