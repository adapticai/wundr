#!/usr/bin/env bash
set -euo pipefail

# Master Test Runner
# Runs all test suites and generates comprehensive report

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Test suite results
declare -A SUITE_RESULTS
declare -A SUITE_TIMES
declare -A SUITE_DETAILS

# Overall counters
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0
SKIPPED_SUITES=0

# Test suites to run
TEST_SUITES=(
    "validators/claude-md-validator.sh:CLAUDE.md Validation"
    "validators/agent-frontmatter-validator.sh:Agent Frontmatter Validation"
    "validators/hook-validator.sh:Hook Scripts Validation"
    "validators/git-worktree-validator.sh:Git Worktree Validation"
    "validators/template-validator.sh:Template Installation Validation"
    "validators/platform-validator.sh:Cross-Platform Compatibility"
    "integration/full-workflow-test.sh:Full Workflow Integration"
)

# Logging functions
log_header() {
    echo ""
    echo -e "${BOLD}${BLUE}======================================================================"
    echo -e "$1"
    echo -e "======================================================================${NC}"
    echo ""
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_failure() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_skip() { echo -e "${YELLOW}[SKIP]${NC} $1"; }

# ============================================================================
# TEST SUITE EXECUTION
# ============================================================================

run_test_suite() {
    local suite_path="$1"
    local suite_name="$2"
    local full_path="$SCRIPT_DIR/$suite_path"

    ((TOTAL_SUITES++))

    log_info "Running: $suite_name"

    # Check if test exists
    if [[ ! -f "$full_path" ]]; then
        log_skip "$suite_name (file not found)"
        SUITE_RESULTS["$suite_name"]="SKIPPED"
        ((SKIPPED_SUITES++))
        return
    fi

    # Make executable if needed
    chmod +x "$full_path" 2>/dev/null || true

    # Run test and capture output
    local start_time=$(date +%s)
    local output_file=$(mktemp)

    if bash "$full_path" > "$output_file" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        SUITE_RESULTS["$suite_name"]="PASSED"
        SUITE_TIMES["$suite_name"]=$duration
        SUITE_DETAILS["$suite_name"]=$(tail -5 "$output_file")

        log_success "$suite_name (${duration}s)"
        ((PASSED_SUITES++))
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        SUITE_RESULTS["$suite_name"]="FAILED"
        SUITE_TIMES["$suite_name"]=$duration
        SUITE_DETAILS["$suite_name"]=$(tail -20 "$output_file")

        log_failure "$suite_name (${duration}s)"
        ((FAILED_SUITES++))

        # Show failure details
        echo -e "${RED}Failure Details:${NC}"
        tail -10 "$output_file" | sed 's/^/  /'
        echo ""
    fi

    rm -f "$output_file"
}

# ============================================================================
# REPORTING
# ============================================================================

generate_summary() {
    log_header "Test Suite Summary"

    echo -e "${BOLD}Overall Results:${NC}"
    echo -e "  Total Suites:    $TOTAL_SUITES"
    echo -e "  ${GREEN}Passed:          $PASSED_SUITES${NC}"
    echo -e "  ${RED}Failed:          $FAILED_SUITES${NC}"
    echo -e "  ${YELLOW}Skipped:         $SKIPPED_SUITES${NC}"
    echo ""

    if [[ $TOTAL_SUITES -gt 0 ]]; then
        local pass_rate=$((PASSED_SUITES * 100 / TOTAL_SUITES))
        echo -e "  ${BOLD}Pass Rate:       ${pass_rate}%${NC}"
    fi

    echo ""
}

generate_detailed_report() {
    log_header "Detailed Results"

    for suite_def in "${TEST_SUITES[@]}"; do
        local suite_name="${suite_def#*:}"
        local result="${SUITE_RESULTS[$suite_name]:-UNKNOWN}"
        local time="${SUITE_TIMES[$suite_name]:-0}"

        case "$result" in
            PASSED)
                echo -e "${GREEN}✓${NC} $suite_name (${time}s)"
                ;;
            FAILED)
                echo -e "${RED}✗${NC} $suite_name (${time}s)"
                ;;
            SKIPPED)
                echo -e "${YELLOW}○${NC} $suite_name"
                ;;
            *)
                echo -e "${YELLOW}?${NC} $suite_name"
                ;;
        esac
    done

    echo ""
}

generate_failure_report() {
    if [[ $FAILED_SUITES -eq 0 ]]; then
        return
    fi

    log_header "Failure Details"

    for suite_def in "${TEST_SUITES[@]}"; do
        local suite_name="${suite_def#*:}"
        local result="${SUITE_RESULTS[$suite_name]:-UNKNOWN}"

        if [[ "$result" == "FAILED" ]]; then
            echo -e "${RED}${BOLD}$suite_name:${NC}"
            echo "${SUITE_DETAILS[$suite_name]}" | sed 's/^/  /'
            echo ""
        fi
    done
}

save_report_to_file() {
    local report_file="$PROJECT_ROOT/test-results.txt"

    {
        echo "======================================================================"
        echo "  Wundr Test Suite Report"
        echo "  Generated: $(date)"
        echo "======================================================================"
        echo ""
        echo "Overall Results:"
        echo "  Total Suites:    $TOTAL_SUITES"
        echo "  Passed:          $PASSED_SUITES"
        echo "  Failed:          $FAILED_SUITES"
        echo "  Skipped:         $SKIPPED_SUITES"
        echo ""

        if [[ $TOTAL_SUITES -gt 0 ]]; then
            local pass_rate=$((PASSED_SUITES * 100 / TOTAL_SUITES))
            echo "  Pass Rate:       ${pass_rate}%"
        fi

        echo ""
        echo "Detailed Results:"
        echo ""

        for suite_def in "${TEST_SUITES[@]}"; do
            local suite_name="${suite_def#*:}"
            local result="${SUITE_RESULTS[$suite_name]:-UNKNOWN}"
            local time="${SUITE_TIMES[$suite_name]:-0}"

            echo "  [$result] $suite_name (${time}s)"
        done

        if [[ $FAILED_SUITES -gt 0 ]]; then
            echo ""
            echo "======================================================================"
            echo "  Failure Details"
            echo "======================================================================"
            echo ""

            for suite_def in "${TEST_SUITES[@]}"; do
                local suite_name="${suite_def#*:}"
                local result="${SUITE_RESULTS[$suite_name]:-UNKNOWN}"

                if [[ "$result" == "FAILED" ]]; then
                    echo "$suite_name:"
                    echo "${SUITE_DETAILS[$suite_name]}" | sed 's/^/  /'
                    echo ""
                fi
            done
        fi

    } > "$report_file"

    log_info "Report saved to: $report_file"
}

# ============================================================================
# PRE-RUN CHECKS
# ============================================================================

check_dependencies() {
    local missing=()

    # Check required commands
    local required_commands=(bash git node npm)

    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing+=("$cmd")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_failure "Missing required dependencies: ${missing[*]}"
        exit 1
    fi

    log_success "All dependencies available"
}

verify_project_structure() {
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log_warning "package.json not found - some tests may fail"
    fi

    if [[ ! -f "$PROJECT_ROOT/CLAUDE.md" ]]; then
        log_warning "CLAUDE.md not found - validation tests will fail"
    fi

    if [[ ! -d "$PROJECT_ROOT/.git" ]]; then
        log_warning "Not a git repository - git tests may fail"
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    local verbose=false
    local save_report=true
    local continue_on_failure=true

    # Parse arguments
    for arg in "$@"; do
        case $arg in
            --verbose|-v)
                verbose=true
                ;;
            --no-report)
                save_report=false
                ;;
            --stop-on-failure)
                continue_on_failure=false
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  -v, --verbose           Show detailed output"
                echo "  --no-report             Don't save report to file"
                echo "  --stop-on-failure       Stop on first failure"
                echo "  -h, --help              Show this help message"
                echo ""
                echo "Test Suites:"
                for suite_def in "${TEST_SUITES[@]}"; do
                    echo "  - ${suite_def#*:}"
                done
                echo ""
                exit 0
                ;;
        esac
    done

    log_header "Wundr Test Suite Runner"

    # Pre-run checks
    log_info "Checking dependencies..."
    check_dependencies
    verify_project_structure
    echo ""

    # Run all test suites
    log_header "Running Test Suites"

    for suite_def in "${TEST_SUITES[@]}"; do
        IFS=':' read -r suite_path suite_name <<< "$suite_def"

        run_test_suite "$suite_path" "$suite_name"

        # Stop on failure if requested
        if [[ "$continue_on_failure" == false ]] && [[ "${SUITE_RESULTS[$suite_name]}" == "FAILED" ]]; then
            log_failure "Stopping due to test failure"
            break
        fi
    done

    echo ""

    # Generate reports
    generate_summary
    generate_detailed_report
    generate_failure_report

    # Save report to file
    if [[ "$save_report" == true ]]; then
        save_report_to_file
    fi

    # Cleanup
    log_info "Running cleanup..."
    if [[ -f "$SCRIPT_DIR/utils/cleanup-test-artifacts.sh" ]]; then
        bash "$SCRIPT_DIR/utils/cleanup-test-artifacts.sh" >/dev/null 2>&1 || true
    fi

    echo ""

    # Exit with appropriate code
    if [[ $FAILED_SUITES -gt 0 ]]; then
        log_failure "Some tests failed!"
        exit 1
    elif [[ $PASSED_SUITES -eq 0 ]]; then
        log_warning "No tests passed!"
        exit 1
    else
        log_success "All tests passed!"
        exit 0
    fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
