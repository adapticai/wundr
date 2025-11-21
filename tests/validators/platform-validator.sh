#!/usr/bin/env bash
set -euo pipefail

# Cross-Platform Compatibility Validator
# Tests compatibility across different platforms

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
declare -a WARNINGS=()

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++));}
log_failure() { echo -e "${RED}[FAIL]${NC} $1"; FAILURES+=("$1"); ((TESTS_FAILED++));}
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; WARNINGS+=("$1");}

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

# Detect current platform
detect_platform() {
    case "$OSTYPE" in
        darwin*)  echo "macos" ;;
        linux*)   echo "linux" ;;
        msys*|cygwin*|mingw*) echo "windows" ;;
        *)        echo "unknown" ;;
    esac
}

CURRENT_PLATFORM=$(detect_platform)

# ============================================================================
# SHEBANG TESTS
# ============================================================================

test_portable_shebangs() {
    local bad_shebangs=()

    while IFS= read -r script; do
        local shebang=$(head -n1 "$script")

        # Check for non-portable shebangs
        if [[ "$shebang" =~ ^#!/bin/bash$ ]]; then
            # /bin/bash doesn't exist on all systems (e.g., NixOS, some BSD)
            bad_shebangs+=("$script: uses /bin/bash instead of /usr/bin/env bash")
        elif [[ "$shebang" =~ ^#!/bin/sh$ ]]; then
            # Check if script uses bash-specific features
            if grep -q "\\[\\[\\|declare\\|local\\|\\$\(\(" "$script"; then
                bad_shebangs+=("$script: uses bash features with sh shebang")
            fi
        fi
    done < <(find "$PROJECT_ROOT" -type f -name "*.sh" 2>/dev/null)

    if [[ ${#bad_shebangs[@]} -gt 0 ]]; then
        for issue in "${bad_shebangs[@]}"; do
            log_warning "$issue"
        done
        # Warning only, not failure
    fi

    return 0
}

test_env_command_available() {
    command -v env >/dev/null 2>&1
}

# ============================================================================
# PATH SEPARATOR TESTS
# ============================================================================

test_no_hardcoded_path_separators() {
    local issues=()

    while IFS= read -r file; do
        # Look for hardcoded forward slashes in paths (except in URLs)
        if grep -n '[^:]//\|^/[a-zA-Z]' "$file" | grep -v "http://\|https://\|file://" | grep -q .; then
            issues+=("$file: contains hardcoded path separators")
        fi
    done < <(find "$PROJECT_ROOT" -type f \( -name "*.sh" -o -name "*.js" -o -name "*.ts" \) 2>/dev/null)

    if [[ ${#issues[@]} -gt 0 ]]; then
        for issue in "${issues[@]}"; do
            log_warning "$issue"
        done
    fi

    return 0
}

# ============================================================================
# LINE ENDING TESTS
# ============================================================================

test_consistent_line_endings() {
    local mixed_endings=()

    while IFS= read -r file; do
        # Check for mixed line endings
        if file "$file" | grep -q "CRLF"; then
            if [[ "$CURRENT_PLATFORM" != "windows" ]]; then
                mixed_endings+=("$file: contains CRLF line endings")
            fi
        fi
    done < <(find "$PROJECT_ROOT" -type f \( -name "*.sh" -o -name "*.js" -o -name "*.ts" -o -name "*.json" \) 2>/dev/null)

    if [[ ${#mixed_endings[@]} -gt 0 ]]; then
        for issue in "${mixed_endings[@]}"; do
            log_warning "$issue"
        done
    fi

    return 0
}

test_gitattributes_configured() {
    if [[ -f "$PROJECT_ROOT/.gitattributes" ]]; then
        grep -q "eol\|text" "$PROJECT_ROOT/.gitattributes"
    else
        log_warning "No .gitattributes file found for line ending management"
        return 0
    fi
}

# ============================================================================
# COMMAND PORTABILITY TESTS
# ============================================================================

test_gnu_vs_bsd_commands() {
    local potential_issues=()

    while IFS= read -r script; do
        # Check for GNU-specific flags
        if grep -q "sed -i ''" "$script"; then
            potential_issues+=("$script: uses GNU sed -i syntax")
        fi

        if grep -q "date.*--date\|date.*-d" "$script"; then
            potential_issues+=("$script: uses GNU date syntax")
        fi

        if grep -q "readlink -f" "$script"; then
            potential_issues+=("$script: uses GNU readlink -f (not available on macOS)")
        fi

        if grep -q "find.*-printf" "$script"; then
            potential_issues+=("$script: uses GNU find -printf")
        fi
    done < <(find "$PROJECT_ROOT" -type f -name "*.sh" 2>/dev/null)

    if [[ ${#potential_issues[@]} -gt 0 ]]; then
        for issue in "${potential_issues[@]}"; do
            log_warning "$issue"
        done
    fi

    return 0
}

test_required_commands_available() {
    local missing_commands=()
    local required_commands=(git node npm bash)

    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_commands+=("$cmd")
        fi
    done

    if [[ ${#missing_commands[@]} -gt 0 ]]; then
        log_failure "Missing required commands: ${missing_commands[*]}"
        return 1
    fi

    return 0
}

# ============================================================================
# FILESYSTEM TESTS
# ============================================================================

test_case_sensitivity_issues() {
    local duplicates=()

    # Find potential case-sensitivity issues
    while IFS= read -r file; do
        local lower=$(echo "$file" | tr '[:upper:]' '[:lower:]')
        local count=$(find "$(dirname "$file")" -maxdepth 1 -iname "$(basename "$file")" 2>/dev/null | wc -l)

        if [[ $count -gt 1 ]]; then
            duplicates+=("$file")
        fi
    done < <(find "$PROJECT_ROOT" -type f 2>/dev/null | head -100)

    if [[ ${#duplicates[@]} -gt 0 ]]; then
        log_warning "Potential case-sensitivity issues found"
        # This is just a warning
    fi

    return 0
}

test_special_characters_in_filenames() {
    local special_char_files=()

    while IFS= read -r file; do
        local basename=$(basename "$file")
        if [[ "$basename" =~ [[:space:]\'\"\`\$\&\|\;\<\>\(\)\[\]\{\}] ]]; then
            special_char_files+=("$file")
        fi
    done < <(find "$PROJECT_ROOT" -type f 2>/dev/null)

    if [[ ${#special_char_files[@]} -gt 0 ]]; then
        log_warning "Files with special characters: ${#special_char_files[@]} found"
        for file in "${special_char_files[@]:0:5}"; do
            echo "  - $file"
        done
    fi

    return 0
}

test_max_path_length() {
    local long_paths=()
    local max_length=260 # Windows MAX_PATH

    while IFS= read -r file; do
        if [[ ${#file} -gt $max_length ]]; then
            long_paths+=("$file")
        fi
    done < <(find "$PROJECT_ROOT" -type f 2>/dev/null)

    if [[ ${#long_paths[@]} -gt 0 ]]; then
        log_warning "Paths exceeding Windows MAX_PATH (260): ${#long_paths[@]} found"
    fi

    return 0
}

# ============================================================================
# PERMISSION TESTS
# ============================================================================

test_executable_permissions_documented() {
    local executables=()

    while IFS= read -r file; do
        if [[ -x "$file" ]] && [[ -f "$file" ]]; then
            executables+=("$file")
        fi
    done < <(find "$PROJECT_ROOT" -type f -name "*.sh" -o -name "*.js" 2>/dev/null)

    # Check if README documents what should be executable
    if [[ -f "$PROJECT_ROOT/README.md" ]]; then
        if ! grep -qi "permission\|executable\|chmod" "$PROJECT_ROOT/README.md"; then
            log_warning "Executable permissions not documented in README"
        fi
    fi

    return 0
}

# ============================================================================
# ENVIRONMENT VARIABLE TESTS
# ============================================================================

test_env_var_portability() {
    local issues=()

    while IFS= read -r script; do
        # Check for common env var issues
        if grep -q '\$HOME' "$script"; then
            # HOME might not be set in all environments
            if ! grep -q 'HOME:-\|HOME:=\|HOME?' "$script"; then
                issues+=("$script: uses \$HOME without default")
            fi
        fi
    done < <(find "$PROJECT_ROOT" -type f -name "*.sh" 2>/dev/null)

    if [[ ${#issues[@]} -gt 0 ]]; then
        for issue in "${issues[@]:0:5}"; do
            log_warning "$issue"
        done
    fi

    return 0
}

# ============================================================================
# NODE/NPM VERSION TESTS
# ============================================================================

test_node_version_documented() {
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        if ! grep -q '"engines"' "$PROJECT_ROOT/package.json"; then
            log_warning "Node version requirements not specified in package.json"
        fi
    fi
    return 0
}

test_npm_scripts_portable() {
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        # Check for platform-specific commands in scripts
        if grep -A 20 '"scripts"' "$PROJECT_ROOT/package.json" | \
           grep -q "rm -rf\|del \|copy \|move "; then
            log_warning "package.json scripts may use platform-specific commands"
        fi
    fi
    return 0
}

# ============================================================================
# INTEGRATION TESTS
# ============================================================================

test_build_on_current_platform() {
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        local test_dir=$(mktemp -d)
        cp -r "$PROJECT_ROOT"/* "$test_dir/" 2>/dev/null || true

        cd "$test_dir"

        if npm install >/dev/null 2>&1; then
            if grep -q '"build"' package.json; then
                if ! timeout 60 npm run build >/dev/null 2>&1; then
                    log_failure "Build fails on $CURRENT_PLATFORM"
                    cd - >/dev/null
                    rm -rf "$test_dir"
                    return 1
                fi
            fi
        fi

        cd - >/dev/null
        rm -rf "$test_dir"
    fi

    return 0
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo "======================================================================"
    echo "  Cross-Platform Compatibility Validation Test Suite"
    echo "======================================================================"
    echo ""
    log_info "Current platform: $CURRENT_PLATFORM"
    log_info "OS Type: $OSTYPE"
    echo ""

    # Shebang Tests
    echo -e "${BLUE}Testing Shebang Portability...${NC}"
    run_test "Portable shebangs" test_portable_shebangs
    run_test "env command available" test_env_command_available
    echo ""

    # Path Tests
    echo -e "${BLUE}Testing Path Handling...${NC}"
    run_test "No hardcoded path separators" test_no_hardcoded_path_separators
    echo ""

    # Line Ending Tests
    echo -e "${BLUE}Testing Line Endings...${NC}"
    run_test "Consistent line endings" test_consistent_line_endings
    run_test ".gitattributes configured" test_gitattributes_configured
    echo ""

    # Command Portability
    echo -e "${BLUE}Testing Command Portability...${NC}"
    run_test "GNU vs BSD command compatibility" test_gnu_vs_bsd_commands
    run_test "Required commands available" test_required_commands_available
    echo ""

    # Filesystem Tests
    echo -e "${BLUE}Testing Filesystem Compatibility...${NC}"
    run_test "Case sensitivity issues" test_case_sensitivity_issues
    run_test "Special characters in filenames" test_special_characters_in_filenames
    run_test "Path length compatibility" test_max_path_length
    echo ""

    # Permission Tests
    echo -e "${BLUE}Testing Permissions...${NC}"
    run_test "Executable permissions documented" test_executable_permissions_documented
    echo ""

    # Environment Tests
    echo -e "${BLUE}Testing Environment Variables...${NC}"
    run_test "Environment variable portability" test_env_var_portability
    echo ""

    # Node/NPM Tests
    echo -e "${BLUE}Testing Node/NPM Compatibility...${NC}"
    run_test "Node version documented" test_node_version_documented
    run_test "NPM scripts portable" test_npm_scripts_portable
    echo ""

    # Integration Tests
    echo -e "${BLUE}Testing Build on Current Platform...${NC}"
    run_test "Build succeeds on $CURRENT_PLATFORM" test_build_on_current_platform
    echo ""

    # Summary
    echo "======================================================================"
    echo "  Test Summary"
    echo "======================================================================"
    echo -e "Platform:     $CURRENT_PLATFORM"
    echo -e "Total Tests:  $TESTS_RUN"
    echo -e "${GREEN}Passed:       $TESTS_PASSED${NC}"
    echo -e "${RED}Failed:       $TESTS_FAILED${NC}"
    echo -e "${YELLOW}Warnings:     ${#WARNINGS[@]}${NC}"
    echo ""

    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        echo -e "${YELLOW}Warnings:${NC}"
        for warning in "${WARNINGS[@]:0:10}"; do
            echo "  - $warning"
        done
        echo ""
    fi

    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${RED}Failed Tests:${NC}"
        for failure in "${FAILURES[@]}"; do
            echo "  - $failure"
        done
        echo ""
        exit 1
    else
        echo -e "${GREEN}All tests passed!${NC}"
        if [[ ${#WARNINGS[@]} -gt 0 ]]; then
            echo -e "${YELLOW}Review warnings for potential cross-platform issues${NC}"
        fi
        exit 0
    fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
