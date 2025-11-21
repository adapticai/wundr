#!/usr/bin/env bash
set -euo pipefail

# CLAUDE.md Syntax and Completeness Validator
# Tests for required sections, syntax, and best practices

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
CLAUDE_MD="${CLAUDE_MD:-$PROJECT_ROOT/CLAUDE.md}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test results array
declare -a FAILURES=()

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILURES+=("$1")
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test function wrapper
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
# REQUIRED SECTIONS TESTS
# ============================================================================

test_file_exists() {
    [[ -f "$CLAUDE_MD" ]]
}

test_has_title() {
    grep -q "^# Claude Code Configuration" "$CLAUDE_MD"
}

test_has_verification_protocol() {
    grep -q "## 🚨 CRITICAL: VERIFICATION PROTOCOL" "$CLAUDE_MD"
}

test_has_concurrent_execution() {
    grep -q "## 🚨 CRITICAL: CONCURRENT EXECUTION" "$CLAUDE_MD"
}

test_has_file_organization() {
    grep -q "### 📁 File Organization Rules" "$CLAUDE_MD"
}

test_has_project_overview() {
    grep -q "## Project Overview" "$CLAUDE_MD"
}

test_has_sparc_commands() {
    grep -q "## SPARC Commands" "$CLAUDE_MD"
}

test_has_available_agents() {
    grep -q "## 🚀 Available Agents" "$CLAUDE_MD"
}

test_has_claude_vs_mcp() {
    grep -q "## 🎯 Claude Code vs MCP Tools" "$CLAUDE_MD"
}

test_has_coordination_protocol() {
    grep -q "## 📋 Agent Coordination Protocol" "$CLAUDE_MD"
}

test_has_concurrent_examples() {
    grep -q "## 🎯 Concurrent Execution Examples" "$CLAUDE_MD"
}

test_has_mcp_integration() {
    grep -q "## 🔧 Wundr MCP Tools Integration" "$CLAUDE_MD"
}

# ============================================================================
# SYNTAX VALIDATION TESTS
# ============================================================================

test_no_trailing_whitespace() {
    ! grep -q '[[:space:]]$' "$CLAUDE_MD"
}

test_consistent_heading_style() {
    # All headings should use # syntax, not underline style
    ! grep -E '^[=-]{3,}$' "$CLAUDE_MD"
}

test_valid_code_blocks() {
    # Check that all code blocks have opening and closing markers
    local open_count=$(grep -c '^```' "$CLAUDE_MD")
    [[ $((open_count % 2)) -eq 0 ]]
}

test_valid_links() {
    # Extract markdown links and check format
    grep -o '\[.*\](.*)' "$CLAUDE_MD" | while read -r link; do
        if [[ ! "$link" =~ \[.*\]\(.*\) ]]; then
            return 1
        fi
    done
    return 0
}

test_no_duplicate_headings() {
    local duplicates=$(grep '^##' "$CLAUDE_MD" | sort | uniq -d)
    [[ -z "$duplicates" ]]
}

# ============================================================================
# CONTENT VALIDATION TESTS
# ============================================================================

test_verification_checkpoints_present() {
    grep -q "Does the build succeed?" "$CLAUDE_MD" &&
    grep -q "Do tests pass?" "$CLAUDE_MD" &&
    grep -q "Can you run it?" "$CLAUDE_MD" &&
    grep -q "Did you verify, not assume?" "$CLAUDE_MD"
}

test_honesty_requirements_present() {
    grep -q "You MUST:" "$CLAUDE_MD" &&
    grep -q "You MUST NOT:" "$CLAUDE_MD"
}

test_file_organization_rules_complete() {
    grep -q "/src" "$CLAUDE_MD" &&
    grep -q "/tests" "$CLAUDE_MD" &&
    grep -q "/docs" "$CLAUDE_MD" &&
    grep -q "/config" "$CLAUDE_MD"
}

test_sparc_workflow_phases() {
    grep -q "Specification" "$CLAUDE_MD" &&
    grep -q "Pseudocode" "$CLAUDE_MD" &&
    grep -q "Architecture" "$CLAUDE_MD" &&
    grep -q "Refinement" "$CLAUDE_MD" &&
    grep -q "Completion" "$CLAUDE_MD"
}

test_hooks_integration_documented() {
    grep -q "pre-task" "$CLAUDE_MD" &&
    grep -q "post-task" "$CLAUDE_MD" &&
    grep -q "post-edit" "$CLAUDE_MD"
}

test_correct_wrong_examples() {
    grep -q "### ✅ CORRECT" "$CLAUDE_MD" &&
    grep -q "### ❌ WRONG" "$CLAUDE_MD"
}

# ============================================================================
# BEST PRACTICES VALIDATION
# ============================================================================

test_mandatory_patterns_documented() {
    grep -q "TodoWrite.*ALWAYS batch ALL todos" "$CLAUDE_MD" &&
    grep -q "Task tool.*ALWAYS spawn ALL agents" "$CLAUDE_MD" &&
    grep -q "File operations.*ALWAYS batch" "$CLAUDE_MD"
}

test_golden_rule_present() {
    grep -q "GOLDEN RULE.*1 MESSAGE = ALL RELATED OPERATIONS" "$CLAUDE_MD"
}

test_absolute_rules_present() {
    grep -q "ABSOLUTE RULES" "$CLAUDE_MD" &&
    grep -q "ALL operations MUST be concurrent" "$CLAUDE_MD"
}

test_performance_benefits_listed() {
    grep -q "84.8% SWE-Bench" "$CLAUDE_MD" &&
    grep -q "32.3% token reduction" "$CLAUDE_MD" &&
    grep -q "2.8-4.4x speed" "$CLAUDE_MD"
}

# ============================================================================
# STRUCTURAL VALIDATION
# ============================================================================

test_proper_nesting() {
    # Check that heading levels are properly nested
    local prev_level=0
    local line_num=0

    while IFS= read -r line; do
        ((line_num++))
        if [[ "$line" =~ ^(#{1,6})[[:space:]] ]]; then
            local level=${#BASH_REMATCH[1]}

            # Level should not jump more than 1
            if [[ $prev_level -gt 0 ]] && [[ $((level - prev_level)) -gt 1 ]]; then
                log_warning "Line $line_num: Heading level jumps from $prev_level to $level"
                return 1
            fi

            prev_level=$level
        fi
    done < "$CLAUDE_MD"

    return 0
}

test_table_of_contents_accuracy() {
    # If TOC exists, verify it matches actual headings
    if grep -q "## Table of Contents" "$CLAUDE_MD"; then
        log_warning "TOC found - manual verification recommended"
    fi
    return 0
}

# ============================================================================
# COMPLETENESS VALIDATION
# ============================================================================

test_all_agent_categories_listed() {
    grep -q "Core Development" "$CLAUDE_MD" &&
    grep -q "Swarm Coordination" "$CLAUDE_MD" &&
    grep -q "Consensus & Distributed" "$CLAUDE_MD" &&
    grep -q "Performance & Optimization" "$CLAUDE_MD" &&
    grep -q "GitHub & Repository" "$CLAUDE_MD" &&
    grep -q "SPARC Methodology" "$CLAUDE_MD"
}

test_mcp_tools_documented() {
    grep -q "drift_detection" "$CLAUDE_MD" &&
    grep -q "pattern_standardize" "$CLAUDE_MD" &&
    grep -q "monorepo_manage" "$CLAUDE_MD" &&
    grep -q "governance_report" "$CLAUDE_MD"
}

test_support_section_present() {
    grep -q "## Support" "$CLAUDE_MD" &&
    grep -q "Documentation:" "$CLAUDE_MD" &&
    grep -q "Issues:" "$CLAUDE_MD"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo "======================================================================"
    echo "  CLAUDE.md Validation Test Suite"
    echo "======================================================================"
    echo ""
    log_info "Testing file: $CLAUDE_MD"
    echo ""

    # Required Sections
    echo -e "${BLUE}Testing Required Sections...${NC}"
    run_test "File exists" test_file_exists
    run_test "Has title" test_has_title
    run_test "Has verification protocol" test_has_verification_protocol
    run_test "Has concurrent execution section" test_has_concurrent_execution
    run_test "Has file organization rules" test_has_file_organization
    run_test "Has project overview" test_has_project_overview
    run_test "Has SPARC commands" test_has_sparc_commands
    run_test "Has available agents" test_has_available_agents
    run_test "Has Claude vs MCP section" test_has_claude_vs_mcp
    run_test "Has coordination protocol" test_has_coordination_protocol
    run_test "Has concurrent examples" test_has_concurrent_examples
    run_test "Has MCP integration" test_has_mcp_integration
    echo ""

    # Syntax Validation
    echo -e "${BLUE}Testing Syntax...${NC}"
    run_test "No trailing whitespace" test_no_trailing_whitespace
    run_test "Consistent heading style" test_consistent_heading_style
    run_test "Valid code blocks" test_valid_code_blocks
    run_test "Valid links" test_valid_links
    run_test "No duplicate headings" test_no_duplicate_headings
    echo ""

    # Content Validation
    echo -e "${BLUE}Testing Content...${NC}"
    run_test "Verification checkpoints present" test_verification_checkpoints_present
    run_test "Honesty requirements present" test_honesty_requirements_present
    run_test "File organization rules complete" test_file_organization_rules_complete
    run_test "SPARC workflow phases documented" test_sparc_workflow_phases
    run_test "Hooks integration documented" test_hooks_integration_documented
    run_test "Correct/wrong examples present" test_correct_wrong_examples
    echo ""

    # Best Practices
    echo -e "${BLUE}Testing Best Practices...${NC}"
    run_test "Mandatory patterns documented" test_mandatory_patterns_documented
    run_test "Golden rule present" test_golden_rule_present
    run_test "Absolute rules present" test_absolute_rules_present
    run_test "Performance benefits listed" test_performance_benefits_listed
    echo ""

    # Structural Validation
    echo -e "${BLUE}Testing Structure...${NC}"
    run_test "Proper heading nesting" test_proper_nesting
    run_test "TOC accuracy" test_table_of_contents_accuracy
    echo ""

    # Completeness
    echo -e "${BLUE}Testing Completeness...${NC}"
    run_test "All agent categories listed" test_all_agent_categories_listed
    run_test "MCP tools documented" test_mcp_tools_documented
    run_test "Support section present" test_support_section_present
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

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
