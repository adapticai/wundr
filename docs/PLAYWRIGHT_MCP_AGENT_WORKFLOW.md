# Playwright MCP - Agent Integration Workflow

## Overview

This guide provides instructions for QA Engineers, Test Automation Engineers, and other agents to
integrate Playwright MCP for browser automation testing in the Wundr development workflow.

## Prerequisites

- Playwright MCP installed: `claude mcp list | grep playwright`
- Neolith dev server running: `npm run dev` (port 3000)
- Project root: `/Users/iroselli/wundr`
- Working directory: `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web`

## Quick Start for Agents

### Step 1: Verify Playwright MCP Connection

```bash
# Command for any agent to run
claude mcp list

# Expected output
playwright: npx @executeautomation/playwright-mcp-server - ✓ Connected
```

### Step 2: Access Test Resources

```bash
# Test template
/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/__tests__/playwright-mcp-test-template.ts

# Page validation tests
/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/__tests__/neolith-page-validation.test.ts

# Documentation
/Users/iroselli/wundr/docs/PLAYWRIGHT_MCP_GUIDE.md
/Users/iroselli/wundr/docs/PLAYWRIGHT_MCP_COMMANDS.md
```

### Step 3: Use in Your Tasks

```bash
# Automated test script
npx @executeautomation/playwright-mcp-server --help

# Or use MCP tools directly in your agent work
mcp_tool__playwright_navigate { url: "http://localhost:3000" }
```

## Agent Roles & Responsibilities

### QA Engineer

**Responsibilities**:

- Create and maintain test plans
- Design test cases for new features
- Validate page navigation and flows
- Report quality metrics

**Using Playwright MCP**:

```
1. Review feature requirements
2. Map to Neolith pages (24 total)
3. Create test cases using playwright_navigate + assertions
4. Execute and document results
5. Report coverage percentage
```

**Example Task**:

```
"Create comprehensive test suite for user login flow:
1. Test valid credentials
2. Test invalid password
3. Test missing email
4. Verify error messages
5. Capture screenshots at each step
6. Document test results"
```

### Test Automation Engineer

**Responsibilities**:

- Implement automated test scripts
- Maintain test framework
- Optimize test performance
- CI/CD integration

**Using Playwright MCP**:

```
1. Write test cases using template patterns
2. Implement page object models
3. Handle test data and fixtures
4. Execute parallel tests
5. Generate test reports
```

**Example Workflow**:

```typescript
// Using the template helpers
import {
  navigateToRoute,
  fillLoginForm,
  submitLoginForm,
  takeScreenshot,
  executeFlow,
} from './playwright-mcp-test-template';

// Execute login flow
await executeFlow(page, [
  async p => await navigateToRoute(p, '/login'),
  async p => await fillLoginForm(p, 'user@test.com', 'pass123'),
  async p => await submitLoginForm(p),
  async p => await takeScreenshot(p, 'login_success'),
]);
```

### Backend Engineer (Testing APIs)

**Responsibilities**:

- Validate API responses through UI
- Test integration points
- Verify data flow

**Using Playwright MCP**:

```
1. Navigate to UI that consumes API
2. Verify displayed data matches API response
3. Test error handling
4. Validate state persistence
```

**Example**:

```
"Validate agent creation API integration:
1. Navigate to /agents page
2. Click 'Create Agent' button
3. Fill form with test data
4. Submit form
5. Verify agent appears in list
6. Confirm API data displayed correctly"
```

### Frontend Engineer (UI Implementation)

**Responsibilities**:

- Validate UI implementation
- Test interactive components
- Verify responsive behavior

**Using Playwright MCP**:

```
1. Navigate to implemented page
2. Test form inputs and buttons
3. Verify error states
4. Test state changes
5. Capture visual regression screenshots
```

**Example**:

```
"Test profile settings page implementation:
1. Navigate to /[workspaceId]/settings/profile
2. Verify form fields display current values
3. Test form validation
4. Submit changes
5. Verify success notification
6. Confirm changes persisted"
```

### QA Agent (Specialized)

**File Location**: `/Users/iroselli/wundr/.claude/agents/qa/qa-engineer.json`

**Configuration**:

```json
{
  "name": "qa-engineer",
  "type": "qa-engineer",
  "capabilities": ["test_planning", "test_execution", "defect_analysis", "quality_metrics"],
  "tools": ["playwright-mcp"],
  "specialization": "Quality assurance and test automation"
}
```

**Common Tasks**:

```bash
# Task 1: Smoke Test Suite
"Run smoke tests on all 24 Neolith pages:
1. Login to application
2. Navigate to each main page
3. Verify page loads without errors
4. Capture screenshot
5. Report coverage and issues"

# Task 2: Feature Testing
"Test workspace creation feature:
1. Navigate to dashboard
2. Create new workspace
3. Verify workspace created
4. Check workspace appears in list
5. Test workspace settings
6. Verify all features accessible"

# Task 3: Regression Testing
"Execute regression test suite:
1. Run all 24 page navigation tests
2. Verify form submissions
3. Test user interactions
4. Validate error handling
5. Generate regression report"

# Task 4: Performance Testing
"Measure page load performance:
1. Navigate to each main page
2. Record load time
3. Measure with different network conditions
4. Report performance metrics
5. Identify slowest pages"
```

## Common Workflows

### Workflow 1: Feature Acceptance Testing

```
Agent Input: "Test the new agent creation workflow"

Steps:
1. Review feature requirements
2. Navigate to /[workspaceId]/agents
3. Click "Create Agent" button
4. Fill form fields:
   - Agent name
   - Description
   - Configuration
5. Submit form
6. Verify agent in list
7. Click agent to view details
8. Verify all data displayed correctly
9. Take screenshots at key points
10. Document results: PASS/FAIL
```

**MCP Commands Used**:

```
playwright_navigate
playwright_click
playwright_fill
playwright_wait_for_selector
playwright_screenshot
playwright_get_text
```

### Workflow 2: Cross-Browser Testing

```
Agent Input: "Test login functionality across browsers"

Steps:
1. Create context for Chrome
2. Run login tests
3. Create context for Firefox
4. Run login tests
5. Create context for Safari
6. Run login tests
7. Compare results
8. Report compatibility issues
```

**MCP Commands Used**:

```
playwright_create_context
playwright_navigate
playwright_fill
playwright_click
playwright_screenshot
playwright_close_context
```

### Workflow 3: User Journey Testing

```
Agent Input: "Test complete new user onboarding"

Steps:
1. Navigate to /register
2. Fill registration form
3. Submit and wait for email verification
4. Navigate to /login
5. Login with new account
6. Complete workspace setup
7. Navigate through dashboard
8. Access key features
9. Take screenshots at each stage
10. Document journey and issues
```

**MCP Commands Used**:

```
playwright_navigate
playwright_fill
playwright_click
playwright_wait_for_selector
playwright_wait_for_navigation
playwright_screenshot
playwright_query_selector_all
```

### Workflow 4: Accessibility Testing

```
Agent Input: "Test accessibility of dashboard page"

Steps:
1. Navigate to dashboard
2. Test keyboard navigation (Tab, Enter, Escape)
3. Verify form labels
4. Check color contrast
5. Test screen reader compatibility
6. Verify focus indicators
7. Document accessibility issues
8. Create tickets for fixes
```

**MCP Commands Used**:

```
playwright_navigate
playwright_press
playwright_get_html
playwright_get_text
playwright_query_selector_all
```

## Integration with SPARC Methodology

### Specification Phase

```bash
npx claude-flow sparc run spec-pseudocode "Create test specification for login page"

# Playwright MCP helps by:
1. Navigating to actual page
2. Documenting current UI/behavior
3. Identifying all interactive elements
4. Verifying expected functionality
```

### Pseudocode Phase

```bash
npx claude-flow sparc run spec-pseudocode "Write test algorithm for form validation"

# Playwright MCP helps by:
1. Testing actual form behavior
2. Identifying edge cases
3. Documenting error messages
4. Recording state changes
```

### Architecture Phase

```bash
npx claude-flow sparc run architect "Design test framework for Neolith"

# Playwright MCP helps by:
1. Understanding page structure
2. Identifying common patterns
3. Designing page objects
4. Planning test organization
```

### Refinement Phase

```bash
npx claude-flow sparc tdd "Implement login tests with TDD"

# Playwright MCP helps by:
1. Write test first
2. Use playwright_navigate to test
3. Verify page elements exist
4. Refine tests iteratively
```

### Completion Phase

```bash
npx claude-flow sparc run integration "Integrate tests into CI/CD"

# Playwright MCP helps by:
1. Running tests in pipeline
2. Capturing failures
3. Reporting results
4. Blocking on critical failures
```

## Common Patterns & Examples

### Pattern 1: Simple Navigation Test

```bash
mcp_tool__playwright_navigate { url: "http://localhost:3000/login" }
mcp_tool__playwright_wait_for_selector { selector: "form" }
mcp_tool__playwright_get_title
# Expected: "Neolith"
```

### Pattern 2: Form Submission Test

```bash
mcp_tool__playwright_navigate { url: "http://localhost:3000/login" }
mcp_tool__playwright_fill { selector: "input[name='email']", value: "test@test.com" }
mcp_tool__playwright_fill { selector: "input[name='password']", value: "password" }
mcp_tool__playwright_click { selector: "button[type='submit']" }
mcp_tool__playwright_wait_for_navigation
mcp_tool__playwright_get_url
# Should contain: "/dashboard" or "/[workspaceId]"
```

### Pattern 3: Multi-Step Flow

```bash
# Step 1: Login
mcp_tool__playwright_navigate { url: "http://localhost:3000/login" }
mcp_tool__playwright_fill { selector: "input[name='email']", value: "user@test.com" }
mcp_tool__playwright_fill { selector: "input[name='password']", value: "pass123" }
mcp_tool__playwright_click { selector: "button[type='submit']" }
mcp_tool__playwright_wait_for_navigation

# Step 2: Navigate to agents
mcp_tool__playwright_click { selector: "a[href*='/agents']" }
mcp_tool__playwright_wait_for_selector { selector: ".agents-list" }

# Step 3: Create agent
mcp_tool__playwright_click { selector: "button:has-text('Create')" }
mcp_tool__playwright_fill { selector: "input[name='agentName']", value: "Test Agent" }
mcp_tool__playwright_click { selector: "button[type='submit']" }

# Step 4: Verify
mcp_tool__playwright_wait_for_selector { selector: ".agent-card" }
mcp_tool__playwright_screenshot { path: "agent-created.png" }
```

## Performance Considerations

### Optimize Test Execution

1. **Parallel Testing**
   - Run independent tests simultaneously
   - Use separate contexts for isolation

2. **Wait Optimization**
   - Use `networkidle` for complete load
   - Use `domcontentloaded` for faster completion
   - Set appropriate timeouts

3. **Resource Management**
   - Close contexts after tests
   - Clear cookies between test runs
   - Reuse contexts for related tests

### Example Optimized Flow

```bash
# Bad: Waits 30 seconds unnecessarily
mcp_tool__playwright_wait_for_timeout { ms: 30000 }

# Good: Waits for specific element
mcp_tool__playwright_wait_for_selector {
  selector: ".confirmation",
  timeout: 5000
}

# Better: Uses load state
mcp_tool__playwright_wait_for_load_state { state: "networkidle" }
```

## Error Handling & Recovery

### Common Issues for Agents

| Issue               | Solution                  | MCP Command                  |
| ------------------- | ------------------------- | ---------------------------- |
| Page not loading    | Wait for specific element | `wait_for_selector`          |
| Element not found   | Verify selector           | `query_selector`             |
| Navigation failed   | Check URL format          | `get_url`                    |
| Form not submitting | Check for errors          | `get_text` on error elements |
| Session expired     | Clear and re-login        | `clear_cookies` + re-login   |

### Error Recovery Pattern

```bash
# 1. Detect error
mcp_tool__playwright_query_selector { selector: ".error-message" }

# 2. Get error text
mcp_tool__playwright_get_text { selector: ".error-message" }

# 3. Take screenshot for debugging
mcp_tool__playwright_screenshot { path: "error-state.png" }

# 4. Clear problematic state
mcp_tool__playwright_clear_cookies

# 5. Retry
mcp_tool__playwright_navigate { url: "http://localhost:3000/login" }
```

## Reporting & Documentation

### Test Result Template

```markdown
## Test Execution Report

### Summary

- Total Pages Tested: 24
- Pass: 20
- Fail: 2
- Skip: 2
- Coverage: 83%

### Failed Tests

1. VP Health Monitoring - Element not found
2. Integration Settings - Form submission timeout

### Screenshots

- See `/screenshots` directory

### Recommendations

- Investigate VP Health page rendering
- Check Integration Settings form timeout
- Increase timeout to 10000ms
```

### Screenshot Organization

```
screenshots/
├── login_success.png
├── dashboard_loaded.png
├── agent_creation_flow/
│   ├── step1_initial.png
│   ├── step2_form_filled.png
│   └── step3_created.png
├── error_states/
│   ├── invalid_email.png
│   └── session_expired.png
└── performance/
    ├── load_time_graph.png
    └── network_analysis.png
```

## Agent Command Examples

### For QA Engineer Agent

```bash
npx claude-flow sparc run qa-engineer "Execute smoke test suite for Neolith:
1. Test all 24 pages load without errors
2. Verify navigation between pages
3. Test form submissions
4. Capture screenshots
5. Generate coverage report
6. Identify any issues"
```

### For Test Automation Engineer Agent

```bash
npx claude-flow sparc run test-automation-engineer "Implement automated tests for workspace creation:
1. Write test cases using Playwright MCP
2. Create page objects
3. Implement helper functions
4. Execute tests
5. Generate HTML report
6. Integrate into CI/CD"
```

### For Frontend Engineer Agent

```bash
npx claude-flow sparc run frontend-engineer "Verify profile settings page implementation:
1. Navigate to settings page
2. Test form validation
3. Verify form submission
4. Validate error messages
5. Test responsive design
6. Capture screenshots"
```

## Troubleshooting Guide

### Playwright MCP Not Connected

```bash
# Verify installation
claude mcp list | grep playwright

# Reinstall if needed
claude mcp remove playwright
claude mcp add playwright npx @executeautomation/playwright-mcp-server

# Check again
claude mcp list
```

### Dev Server Not Running

```bash
# Start dev server
cd /Users/iroselli/wundr/packages/@wundr/neolith/apps/web
npm run dev

# Verify port 3000
curl http://localhost:3000 | head -20
```

### Tests Timing Out

```bash
# Increase timeout for slow operations
mcp_tool__playwright_wait_for_selector {
  selector: ".element",
  timeout: 30000  # 30 seconds
}

# Or use slower wait state
mcp_tool__playwright_wait_for_load_state { state: "networkidle" }
```

### Selector Not Found

```bash
# First verify selector exists
mcp_tool__playwright_query_selector { selector: ".my-element" }

# If not found, try alternatives
mcp_tool__playwright_query_selector { selector: "[data-testid='my-element']" }

# Get page HTML to debug
mcp_tool__playwright_get_html { selector: "body" }
```

## Resources & Support

### Documentation

- [Playwright MCP Guide](/Users/iroselli/wundr/docs/PLAYWRIGHT_MCP_GUIDE.md)
- [Playwright MCP Commands](/Users/iroselli/wundr/docs/PLAYWRIGHT_MCP_COMMANDS.md)
- [Test Template](/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/__tests__/playwright-mcp-test-template.ts)
- [Page Validation Tests](/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/__tests__/neolith-page-validation.test.ts)

### Support Channels

1. Check this guide for your agent type
2. Review relevant documentation
3. Inspect test template for patterns
4. Check Playwright official docs
5. Open issue with reproduction steps

### Key Contacts

- QA Lead: Review test plans
- DevOps: Integrate into CI/CD
- Backend: Validate API integration
- Frontend: Review UI implementation

---

**Version**: 1.0.0 **Last Updated**: 2025-11-26 **Status**: Ready for Production **Supported
Agents**: QA, Test Automation, Frontend, Backend, DevOps
