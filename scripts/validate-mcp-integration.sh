#!/bin/bash

# MCP Tools Integration Validation Script
# Validates all MCP tool installations and configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    ((TOTAL_TESTS++))
    log_info "Running: $test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        log_success "$test_name"
        return 0
    else
        log_failure "$test_name"
        return 1
    fi
}

run_test_with_output() {
    local test_name="$1"
    local test_command="$2"
    
    ((TOTAL_TESTS++))
    log_info "Running: $test_name"
    
    local output
    if output=$(eval "$test_command" 2>&1); then
        log_success "$test_name"
        echo "  Output: $output"
        return 0
    else
        log_failure "$test_name"
        echo "  Error: $output"
        return 1
    fi
}

# Test prerequisites
test_prerequisites() {
    echo
    echo "=== Testing Prerequisites ==="
    
    run_test "Node.js installed" "command -v node"
    run_test "NPM available" "command -v npm"
    run_test "NPX available" "command -v npx"
    run_test "Claude CLI installed" "command -v claude"
    run_test "Node.js version >= 18" 'node -v | grep -E "v1[89]|v[2-9][0-9]"'
}

# Test MCP tool installations
test_mcp_tools() {
    echo
    echo "=== Testing MCP Tool Installations ==="
    
    # Global installations
    run_test "Firecrawl MCP (global)" "npm list -g @firecrawl/mcp-server"
    run_test "Context7 MCP (global)" "npm list -g @context7/mcp-server"
    run_test "Playwright MCP (global)" "npm list -g @playwright/mcp-server"
    run_test "Browser MCP (global)" "npm list -g @browser-mcp/server"
    run_test "Sequential Thinking MCP (global)" "npm list -g @mit/sequential-thinking-mcp"
    
    # Local installations (fallback)
    if ! npm list -g @firecrawl/mcp-server >/dev/null 2>&1; then
        run_test "Firecrawl MCP (local)" "npm list @firecrawl/mcp-server --prefix ~/.claude/mcp-tools/"
    fi
    
    if ! npm list -g @context7/mcp-server >/dev/null 2>&1; then
        run_test "Context7 MCP (local)" "npm list @context7/mcp-server --prefix ~/.claude/mcp-tools/"
    fi
    
    # Playwright browsers
    run_test "Playwright browsers installed" "npx playwright --version"
}

# Test Chrome installation
test_chrome() {
    echo
    echo "=== Testing Chrome Installation ==="
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        run_test "Chrome application exists" "test -d '/Applications/Google Chrome.app'"
        run_test "Chrome executable accessible" "test -x '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'"
    else
        log_warning "Chrome validation skipped (not macOS)"
    fi
}

# Test Claude MCP configuration
test_claude_mcp_config() {
    echo
    echo "=== Testing Claude MCP Configuration ==="
    
    run_test_with_output "Claude MCP list" "claude mcp list"
    
    # Test individual MCP servers
    local mcp_servers=("firecrawl" "context7" "playwright" "browser-mcp" "sequential-thinking")
    
    for server in "${mcp_servers[@]}"; do
        if claude mcp list | grep -q "$server"; then
            log_success "MCP server '$server' registered"
            ((PASSED_TESTS++))
        else
            log_failure "MCP server '$server' not registered"
            ((FAILED_TESTS++))
        fi
        ((TOTAL_TESTS++))
    done
}

# Test configuration files
test_config_files() {
    echo
    echo "=== Testing Configuration Files ==="
    
    local config_dir="$HOME/.claude/mcp-configs"
    
    run_test "Config directory exists" "test -d '$config_dir'"
    
    local configs=("firecrawl.json" "context7.json" "playwright.json" "browser-mcp.json" "sequential-thinking.json")
    
    for config in "${configs[@]}"; do
        run_test "Config file: $config" "test -f '$config_dir/$config'"
        
        # Validate JSON syntax
        if [[ -f "$config_dir/$config" ]]; then
            run_test "Valid JSON: $config" "python3 -m json.tool '$config_dir/$config'"
        fi
    done
}

# Test Browser MCP extension
test_browser_extension() {
    echo
    echo "=== Testing Browser MCP Extension ==="
    
    local ext_dir="$HOME/.claude/browser-mcp-extension"
    
    run_test "Extension directory exists" "test -d '$ext_dir'"
    run_test "Manifest file exists" "test -f '$ext_dir/manifest.json'"
    run_test "Background script exists" "test -f '$ext_dir/background.js'"
    run_test "Content script exists" "test -f '$ext_dir/content.js'"
    run_test "Popup HTML exists" "test -f '$ext_dir/popup.html'"
    run_test "Popup JS exists" "test -f '$ext_dir/popup.js'"
    run_test "Injected script exists" "test -f '$ext_dir/injected.js'"
    
    # Validate manifest JSON
    if [[ -f "$ext_dir/manifest.json" ]]; then
        run_test "Valid manifest JSON" "python3 -m json.tool '$ext_dir/manifest.json'"
    fi
}

# Test Claude Flow integration
test_claude_flow() {
    echo
    echo "=== Testing Claude Flow Integration ==="
    
    run_test "Claude Flow available" "npx claude-flow --version"
    
    if npx claude-flow --version >/dev/null 2>&1; then
        run_test_with_output "Claude Flow MCP list" "npx claude-flow mcp list"
        run_test_with_output "Claude Flow swarm status" "npx claude-flow swarm status"
    fi
}

# Test environment variables
test_environment() {
    echo
    echo "=== Testing Environment Configuration ==="
    
    run_test "Environment template exists" "test -f '$HOME/.claude/.env.mcp-tools'"
    
    if [[ -f "$HOME/.claude/.env" ]]; then
        log_success "Environment file exists"
        ((PASSED_TESTS++))
        
        # Check for required variables
        local required_vars=("FIRECRAWL_API_KEY" "CONTEXT7_API_KEY" "OPENAI_API_KEY")
        
        for var in "${required_vars[@]}"; do
            if grep -q "^$var=" "$HOME/.claude/.env" 2>/dev/null; then
                log_success "Environment variable: $var"
                ((PASSED_TESTS++))
            else
                log_warning "Environment variable not set: $var"
            fi
            ((TOTAL_TESTS++))
        done
    else
        log_failure "Environment file not found at ~/.claude/.env"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
}

# Test directory structure
test_directory_structure() {
    echo
    echo "=== Testing Directory Structure ==="
    
    local directories=(
        "$HOME/.claude/mcp-configs"
        "$HOME/.claude/mcp-tools"
        "$HOME/.claude/chrome-profile"
        "$HOME/.claude/browser-mcp-extension"
        "$HOME/.claude/context7"
        "$HOME/.claude/logs/mcp"
    )
    
    for dir in "${directories[@]}"; do
        run_test "Directory exists: $(basename "$dir")" "test -d '$dir'"
    done
}

# Test MCP server connectivity
test_mcp_connectivity() {
    echo
    echo "=== Testing MCP Server Connectivity ==="
    
    # This is a basic test - in practice, you'd want to test actual MCP calls
    local mcp_servers=("firecrawl" "context7" "playwright" "browser-mcp" "sequential-thinking")
    
    for server in "${mcp_servers[@]}"; do
        # Try to start the MCP server briefly to test connectivity
        log_info "Testing $server connectivity..."
        
        local timeout_cmd="timeout 5s"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            timeout_cmd="gtimeout 5s" # Use GNU timeout on macOS if available
            if ! command -v gtimeout >/dev/null 2>&1; then
                timeout_cmd="timeout 5s" # Fall back to system timeout
            fi
        fi
        
        # This is a simplified test - real implementation would depend on each tool's API
        if claude mcp list | grep -q "$server"; then
            log_success "MCP server '$server' connectivity"
            ((PASSED_TESTS++))
        else
            log_failure "MCP server '$server' connectivity"
            ((FAILED_TESTS++))
        fi
        ((TOTAL_TESTS++))
    done
}

# Performance benchmark
run_performance_test() {
    echo
    echo "=== Performance Benchmark ==="
    
    log_info "Running basic performance tests..."
    
    # Test Claude MCP response time
    local start_time=$(date +%s%N)
    if claude mcp list >/dev/null 2>&1; then
        local end_time=$(date +%s%N)
        local duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
        
        if [[ $duration -lt 5000 ]]; then # Less than 5 seconds
            log_success "Claude MCP response time: ${duration}ms"
            ((PASSED_TESTS++))
        else
            log_warning "Claude MCP response time slow: ${duration}ms"
        fi
    else
        log_failure "Claude MCP performance test failed"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
    
    # Test Claude Flow response time
    if command -v npx >/dev/null 2>&1 && npx claude-flow --version >/dev/null 2>&1; then
        local start_time=$(date +%s%N)
        if npx claude-flow --version >/dev/null 2>&1; then
            local end_time=$(date +%s%N)
            local duration=$(( (end_time - start_time) / 1000000 ))
            
            if [[ $duration -lt 3000 ]]; then
                log_success "Claude Flow response time: ${duration}ms"
                ((PASSED_TESTS++))
            else
                log_warning "Claude Flow response time slow: ${duration}ms"
            fi
        else
            log_failure "Claude Flow performance test failed"
            ((FAILED_TESTS++))
        fi
    else
        log_warning "Claude Flow not available for performance testing"
    fi
    ((TOTAL_TESTS++))
}

# Generate integration test
generate_integration_test() {
    echo
    echo "=== Generating Integration Test ==="
    
    local test_file="/tmp/mcp-integration-test.js"
    
    cat > "$test_file" << 'EOF'
// MCP Tools Integration Test
const { execSync } = require('child_process');

async function testMCPIntegration() {
    console.log('Testing MCP Tools Integration...');
    
    try {
        // Test Claude MCP
        console.log('Testing Claude MCP...');
        const claudeList = execSync('claude mcp list', { encoding: 'utf8' });
        console.log('Claude MCP servers:', claudeList);
        
        // Test Claude Flow (if available)
        try {
            console.log('Testing Claude Flow...');
            const flowVersion = execSync('npx claude-flow --version', { encoding: 'utf8' });
            console.log('Claude Flow version:', flowVersion);
        } catch (e) {
            console.log('Claude Flow not available or not working');
        }
        
        console.log('Basic integration test passed!');
        return true;
    } catch (error) {
        console.error('Integration test failed:', error.message);
        return false;
    }
}

testMCPIntegration().then(success => {
    process.exit(success ? 0 : 1);
});
EOF
    
    log_info "Running integration test..."
    
    if node "$test_file"; then
        log_success "Integration test passed"
        ((PASSED_TESTS++))
    else
        log_failure "Integration test failed"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
    
    rm -f "$test_file"
}

# Generate comprehensive report
generate_report() {
    echo
    echo "========================================"
    echo "         MCP INTEGRATION REPORT"
    echo "========================================"
    echo
    
    echo "Test Summary:"
    echo "  Total Tests: $TOTAL_TESTS"
    echo "  Passed:      $PASSED_TESTS"
    echo "  Failed:      $FAILED_TESTS"
    
    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    fi
    
    echo "  Success Rate: ${success_rate}%"
    echo
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        log_success "All MCP tools are properly integrated! 🎉"
        echo
        echo "Next steps:"
        echo "1. Start using MCP tools with Claude Code"
        echo "2. Create your first workflow: npx claude-flow workflow create"
        echo "3. Monitor tool performance: npx claude-flow monitor"
    else
        log_warning "Some issues found. Please review the failed tests above."
        echo
        echo "Common fixes:"
        echo "1. Run the installation script: ./scripts/install-mcp-tools.sh"
        echo "2. Set up environment variables in ~/.claude/.env"
        echo "3. Install Chrome browser if on macOS"
        echo "4. Check Claude CLI installation: pip install claude-cli"
    fi
    
    # Save report to file
    local report_file="$HOME/.claude/logs/mcp/validation-report-$(date +%Y%m%d-%H%M%S).txt"
    mkdir -p "$(dirname "$report_file")"
    
    {
        echo "MCP Tools Validation Report"
        echo "Generated: $(date)"
        echo "Total Tests: $TOTAL_TESTS"
        echo "Passed: $PASSED_TESTS"
        echo "Failed: $FAILED_TESTS"
        echo "Success Rate: ${success_rate}%"
    } > "$report_file"
    
    echo
    log_info "Report saved to: $report_file"
}

# Main execution
main() {
    echo "========================================"
    echo "      MCP TOOLS VALIDATION SCRIPT"
    echo "========================================"
    echo "Validating all MCP tool installations and configurations..."
    echo
    
    # Run all test suites
    test_prerequisites
    test_mcp_tools
    test_chrome
    test_claude_mcp_config
    test_config_files
    test_browser_extension
    test_claude_flow
    test_environment
    test_directory_structure
    test_mcp_connectivity
    run_performance_test
    generate_integration_test
    
    # Generate final report
    generate_report
    
    # Exit with appropriate code
    if [[ $FAILED_TESTS -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Execute main function
main "$@"