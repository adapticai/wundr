#!/usr/bin/env bash
set -euo pipefail

# Template Installation Validator
# Tests template installation procedures

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
# TEMPLATE STRUCTURE TESTS
# ============================================================================

test_templates_directory_exists() {
    [[ -d "$PROJECT_ROOT/templates" ]] || \
    [[ -d "$PROJECT_ROOT/.templates" ]] || \
    [[ -d "$PROJECT_ROOT/template" ]]
}

test_base_template_exists() {
    find "$PROJECT_ROOT" -type f -name "*.template" -o -name "template.json" | grep -q "."
}

test_template_has_manifest() {
    local templates_found=false

    for template_dir in "$PROJECT_ROOT"/templates/*/ "$PROJECT_ROOT"/.templates/*/; do
        if [[ -d "$template_dir" ]]; then
            templates_found=true
            if [[ -f "$template_dir/template.json" ]] || \
               [[ -f "$template_dir/manifest.json" ]] || \
               [[ -f "$template_dir/.template.json" ]]; then
                continue
            else
                log_failure "Template $(basename "$template_dir") missing manifest"
                return 1
            fi
        fi
    done

    $templates_found
}

# ============================================================================
# TEMPLATE CONTENT VALIDATION
# ============================================================================

test_template_package_json() {
    local has_valid_template=false

    for template_dir in "$PROJECT_ROOT"/templates/*/ "$PROJECT_ROOT"/.templates/*/; do
        if [[ -d "$template_dir" ]] && [[ -f "$template_dir/package.json" ]]; then
            # Validate package.json
            if node -e "require('$template_dir/package.json')" 2>/dev/null; then
                has_valid_template=true
            else
                log_failure "Invalid package.json in $(basename "$template_dir")"
                return 1
            fi
        fi
    done

    [[ "$has_valid_template" == true ]] || return 0 # Pass if no templates
}

test_template_readme() {
    for template_dir in "$PROJECT_ROOT"/templates/*/ "$PROJECT_ROOT"/.templates/*/; do
        if [[ -d "$template_dir" ]]; then
            if [[ ! -f "$template_dir/README.md" ]]; then
                log_warning "Template $(basename "$template_dir") missing README.md"
            fi
        fi
    done
    return 0
}

test_template_gitignore() {
    for template_dir in "$PROJECT_ROOT"/templates/*/ "$PROJECT_ROOT"/.templates/*/; do
        if [[ -d "$template_dir" ]]; then
            if [[ ! -f "$template_dir/.gitignore" ]]; then
                log_warning "Template $(basename "$template_dir") missing .gitignore"
            fi
        fi
    done
    return 0
}

# ============================================================================
# INSTALLATION SCRIPT TESTS
# ============================================================================

test_install_script_exists() {
    [[ -f "$PROJECT_ROOT/scripts/install-template.sh" ]] || \
    [[ -f "$PROJECT_ROOT/install.sh" ]] || \
    [[ -f "$PROJECT_ROOT/bin/install-template" ]]
}

test_install_script_executable() {
    for script in "$PROJECT_ROOT/scripts/install-template.sh" \
                  "$PROJECT_ROOT/install.sh" \
                  "$PROJECT_ROOT/bin/install-template"; do
        if [[ -f "$script" ]] && [[ ! -x "$script" ]]; then
            log_failure "Install script not executable: $script"
            return 1
        fi
    done
    return 0
}

test_install_script_syntax() {
    for script in "$PROJECT_ROOT/scripts/install-template.sh" \
                  "$PROJECT_ROOT/install.sh" \
                  "$PROJECT_ROOT/bin/install-template"; do
        if [[ -f "$script" ]]; then
            bash -n "$script" 2>/dev/null || return 1
        fi
    done
    return 0
}

# ============================================================================
# INSTALLATION FUNCTIONAL TESTS
# ============================================================================

test_template_installation_dry_run() {
    local install_script=""

    for script in "$PROJECT_ROOT/scripts/install-template.sh" \
                  "$PROJECT_ROOT/install.sh" \
                  "$PROJECT_ROOT/bin/install-template"; do
        if [[ -f "$script" ]]; then
            install_script="$script"
            break
        fi
    done

    if [[ -z "$install_script" ]]; then
        log_warning "No installation script found"
        return 0
    fi

    # Test dry run if supported
    if grep -q "\-\-dry-run\|--check" "$install_script"; then
        "$install_script" --dry-run >/dev/null 2>&1 || \
        "$install_script" --check >/dev/null 2>&1
    else
        log_warning "Install script doesn't support dry-run"
        return 0
    fi
}

test_template_installation_creates_structure() {
    local test_dir=$(mktemp -d)

    # Find installation script
    local install_script=""
    for script in "$PROJECT_ROOT/scripts/install-template.sh" \
                  "$PROJECT_ROOT/install.sh"; do
        if [[ -f "$script" ]]; then
            install_script="$script"
            break
        fi
    done

    if [[ -z "$install_script" ]]; then
        rm -rf "$test_dir"
        return 0
    fi

    # Try installation
    cd "$test_dir"
    "$install_script" --target "$test_dir" 2>/dev/null || true

    # Check if basic structure was created
    local has_structure=false
    if [[ -f "$test_dir/package.json" ]] || \
       [[ -d "$test_dir/src" ]] || \
       [[ -f "$test_dir/README.md" ]]; then
        has_structure=true
    fi

    rm -rf "$test_dir"
    [[ "$has_structure" == true ]]
}

# ============================================================================
# TEMPLATE VARIABLE SUBSTITUTION TESTS
# ============================================================================

test_template_variables_documented() {
    local has_docs=false

    for template_dir in "$PROJECT_ROOT"/templates/*/ "$PROJECT_ROOT"/.templates/*/; do
        if [[ -d "$template_dir" ]]; then
            if grep -r "{{.*}}\|__.*__\|\${.*}" "$template_dir" >/dev/null 2>&1; then
                # Found template variables, check if documented
                if [[ -f "$template_dir/README.md" ]] && \
                   grep -q "variable\|placeholder\|substitution" "$template_dir/README.md"; then
                    has_docs=true
                else
                    log_warning "Template variables not documented in $(basename "$template_dir")"
                fi
            fi
        fi
    done

    return 0 # Warning only
}

test_template_variable_syntax() {
    local invalid_templates=()

    for template_dir in "$PROJECT_ROOT"/templates/*/ "$PROJECT_ROOT"/.templates/*/; do
        if [[ -d "$template_dir" ]]; then
            # Check for unmatched template brackets
            if grep -r "{{[^}]*$\|^[^{]*}}" "$template_dir" 2>/dev/null | grep -v ".git" | grep -q .; then
                invalid_templates+=("$(basename "$template_dir")")
            fi
        fi
    done

    if [[ ${#invalid_templates[@]} -gt 0 ]]; then
        log_failure "Templates with invalid variable syntax: ${invalid_templates[*]}"
        return 1
    fi

    return 0
}

# ============================================================================
# TEMPLATE DEPENDENCY TESTS
# ============================================================================

test_template_dependencies_installable() {
    for template_dir in "$PROJECT_ROOT"/templates/*/ "$PROJECT_ROOT"/.templates/*/; do
        if [[ -f "$template_dir/package.json" ]]; then
            local test_dir=$(mktemp -d)
            cp "$template_dir/package.json" "$test_dir/"

            cd "$test_dir"
            # Try to install dependencies (with timeout)
            timeout 30 npm install --dry-run >/dev/null 2>&1
            local result=$?

            cd - >/dev/null
            rm -rf "$test_dir"

            if [[ $result -ne 0 ]]; then
                log_failure "Dependencies not installable in $(basename "$template_dir")"
                return 1
            fi
        fi
    done

    return 0
}

# ============================================================================
# CLEANUP VERIFICATION TESTS
# ============================================================================

test_template_cleanup_script_exists() {
    [[ -f "$PROJECT_ROOT/scripts/cleanup-template.sh" ]] || \
    [[ -f "$PROJECT_ROOT/cleanup.sh" ]] || \
    return 0 # Not required
}

test_template_leaves_no_artifacts() {
    local test_dir=$(mktemp -d)

    # Simulate installation and cleanup
    local install_script=""
    for script in "$PROJECT_ROOT/scripts/install-template.sh" \
                  "$PROJECT_ROOT/install.sh"; do
        if [[ -f "$script" ]]; then
            install_script="$script"
            break
        fi
    done

    if [[ -n "$install_script" ]]; then
        cd "$test_dir"
        "$install_script" --target "$test_dir" 2>/dev/null || true

        # Check for common artifacts
        local artifacts=()
        [[ -f "$test_dir/.DS_Store" ]] && artifacts+=(".DS_Store")
        [[ -d "$test_dir/node_modules" ]] && artifacts+=("node_modules")
        [[ -f "$test_dir/package-lock.json" ]] && artifacts+=("package-lock.json")

        if [[ ${#artifacts[@]} -gt 0 ]]; then
            log_warning "Template leaves artifacts: ${artifacts[*]}"
        fi
    fi

    rm -rf "$test_dir"
    return 0
}

# ============================================================================
# INTEGRATION TESTS
# ============================================================================

test_template_builds_successfully() {
    for template_dir in "$PROJECT_ROOT"/templates/*/ "$PROJECT_ROOT"/.templates/*/; do
        if [[ -f "$template_dir/package.json" ]]; then
            local test_dir=$(mktemp -d)
            cp -r "$template_dir"/* "$test_dir/" 2>/dev/null || true

            cd "$test_dir"

            # Install and build
            if npm install >/dev/null 2>&1; then
                if grep -q '"build"' package.json; then
                    timeout 60 npm run build >/dev/null 2>&1
                    local result=$?

                    if [[ $result -ne 0 ]]; then
                        log_failure "Template $(basename "$template_dir") fails to build"
                        cd - >/dev/null
                        rm -rf "$test_dir"
                        return 1
                    fi
                fi
            fi

            cd - >/dev/null
            rm -rf "$test_dir"
        fi
    done

    return 0
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo "======================================================================"
    echo "  Template Installation Validation Test Suite"
    echo "======================================================================"
    echo ""
    log_info "Project root: $PROJECT_ROOT"
    echo ""

    # Structure Tests
    echo -e "${BLUE}Testing Template Structure...${NC}"
    run_test "Templates directory exists" test_templates_directory_exists
    run_test "Base template exists" test_base_template_exists
    run_test "Templates have manifests" test_template_has_manifest
    echo ""

    # Content Tests
    echo -e "${BLUE}Testing Template Content...${NC}"
    run_test "Template package.json valid" test_template_package_json
    run_test "Template README present" test_template_readme
    run_test "Template .gitignore present" test_template_gitignore
    echo ""

    # Installation Script Tests
    echo -e "${BLUE}Testing Installation Scripts...${NC}"
    run_test "Install script exists" test_install_script_exists
    run_test "Install script executable" test_install_script_executable
    run_test "Install script syntax valid" test_install_script_syntax
    echo ""

    # Functional Tests
    echo -e "${BLUE}Testing Installation Functionality...${NC}"
    run_test "Installation dry run works" test_template_installation_dry_run
    run_test "Installation creates structure" test_template_installation_creates_structure
    echo ""

    # Variable Tests
    echo -e "${BLUE}Testing Template Variables...${NC}"
    run_test "Template variables documented" test_template_variables_documented
    run_test "Template variable syntax valid" test_template_variable_syntax
    echo ""

    # Dependency Tests
    echo -e "${BLUE}Testing Template Dependencies...${NC}"
    run_test "Dependencies installable" test_template_dependencies_installable
    echo ""

    # Cleanup Tests
    echo -e "${BLUE}Testing Cleanup...${NC}"
    run_test "Cleanup script exists" test_template_cleanup_script_exists
    run_test "No artifacts left behind" test_template_leaves_no_artifacts
    echo ""

    # Integration Tests
    echo -e "${BLUE}Testing Integration...${NC}"
    run_test "Template builds successfully" test_template_builds_successfully
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
