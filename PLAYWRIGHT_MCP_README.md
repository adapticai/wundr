# Playwright MCP Server - Project Integration Guide

**Status**: INSTALLED & READY FOR USE
**Date**: 2025-11-26
**Version**: @executeautomation/playwright-mcp-server

## Overview

The Playwright MCP server has been successfully installed and configured for the Wundr Neolith application. This provides browser automation capabilities for testing all 24 application pages.

## Quick Links

### Documentation (Read These First!)
- **Setup Complete**: `/Users/iroselli/wundr/docs/PLAYWRIGHT_MCP_SETUP_COMPLETE.md` - Overview & validation results
- **User Guide**: `/Users/iroselli/wundr/docs/PLAYWRIGHT_MCP_GUIDE.md` - Installation & available tools
- **Commands Reference**: `/Users/iroselli/wundr/docs/PLAYWRIGHT_MCP_COMMANDS.md` - 50+ command examples
- **Agent Workflows**: `/Users/iroselli/wundr/docs/PLAYWRIGHT_MCP_AGENT_WORKFLOW.md` - Role-specific instructions

### Test Resources (Copy & Use!)
- **Test Template**: `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/__tests__/playwright-mcp-test-template.ts` - 20+ reusable helper functions
- **Page Validation**: `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/__tests__/neolith-page-validation.test.ts` - All 24 pages documented

## Verify Installation

```bash
# Check Playwright MCP is connected
claude mcp list

# Expected output:
# playwright: npx @executeautomation/playwright-mcp-server - ✓ Connected
```

## Dev Server Status

```bash
# Server runs on http://localhost:3000
# Start with: npm run dev
# From: /Users/iroselli/wundr/packages/@wundr/neolith/apps/web
```

## Basic Usage Examples

### Example 1: Navigate to Page
```bash
mcp_tool__playwright_navigate { url: "http://localhost:3000/login" }
mcp_tool__playwright_wait_for_selector { selector: "form" }
mcp_tool__playwright_screenshot { path: "screenshots/login.png" }
```

### Example 2: Login Flow
```bash
# Navigate
mcp_tool__playwright_navigate { url: "http://localhost:3000/login" }

# Fill form
mcp_tool__playwright_fill { selector: "input[name='email']", value: "test@test.com" }
mcp_tool__playwright_fill { selector: "input[name='password']", value: "password" }

# Submit
mcp_tool__playwright_click { selector: "button[type='submit']" }

# Wait and verify
mcp_tool__playwright_wait_for_navigation { timeout: 10000 }
mcp_tool__playwright_get_url
```

### Example 3: Form Interaction
```bash
# Click button
mcp_tool__playwright_click { selector: ".create-button" }

# Wait for element
mcp_tool__playwright_wait_for_selector { selector: ".modal" }

# Select dropdown
mcp_tool__playwright_select { selector: "select[name='role']", option: "admin" }

# Check checkbox
mcp_tool__playwright_check { selector: "input[type='checkbox']" }

# Submit
mcp_tool__playwright_click { selector: "button[type='submit']" }

# Verify
mcp_tool__playwright_wait_for_selector { selector: ".success-message" }
mcp_tool__playwright_screenshot { path: "screenshots/success.png" }
```

## Using Test Template

The template provides ready-to-use helper functions:

```typescript
import {
  navigateToRoute,
  fillLoginForm,
  submitLoginForm,
  takeScreenshot,
  loginUser,
  clickElement,
  fillField,
  getElementText,
  queryElements,
} from './playwright-mcp-test-template';

// Use in your tests
await loginUser(page, 'test@test.com', 'password');
await takeScreenshot(page, 'logged_in');
await clickElement(page, 'a[href="/agents"]');
const agentNames = await queryElements(page, '.agent-name');
```

## Available Pages (24 Total)

### Public Pages (4)
- `/` - Home (redirects to login)
- `/login` - Login page
- `/register` - Registration page
- `/error` - Error page

### Workspace Pages (20)
- `/[workspaceId]/dashboard` - Main dashboard
- `/[workspaceId]/agents` - AI agents management
- `/[workspaceId]/workflows` - Workflow management
- `/[workspaceId]/vps` - Virtual Personalities list
- `/[workspaceId]/vps/[vpId]` - VP details
- `/[workspaceId]/channels/[channelId]` - Channel page
- `/[workspaceId]/channels/[channelId]/settings` - Channel settings
- `/[workspaceId]/call/[callId]` - Call details
- `/[workspaceId]/deployments` - Deployments
- `/[workspaceId]/analytics` - Analytics dashboard
- `/[workspaceId]/admin` - Admin overview
- `/[workspaceId]/admin/members` - Member management
- `/[workspaceId]/admin/roles` - Role management
- `/[workspaceId]/admin/billing` - Billing information
- `/[workspaceId]/admin/activity` - Activity logs
- `/[workspaceId]/admin/settings` - Admin settings
- `/[workspaceId]/admin/vp-health` - VP health monitoring
- `/[workspaceId]/settings/profile` - Profile settings
- `/[workspaceId]/settings/integrations` - Integration settings
- `/[workspaceId]/user-settings/notifications` - Notification preferences

## MCP Tools Available

**Navigation** (5 tools):
- `playwright_navigate` - Navigate to URL
- `playwright_goto` - Go with options
- `playwright_back` - Go back
- `playwright_forward` - Go forward
- `playwright_reload` - Reload page

**Interaction** (8 tools):
- `playwright_click` - Click element
- `playwright_fill` - Fill input
- `playwright_type` - Type text
- `playwright_select` - Select dropdown
- `playwright_check` - Check checkbox
- `playwright_uncheck` - Uncheck checkbox
- `playwright_press` - Press key

**Information** (9 tools):
- `playwright_screenshot` - Take screenshot
- `playwright_get_text` - Get element text
- `playwright_get_html` - Get element HTML
- `playwright_get_url` - Get current URL
- `playwright_get_title` - Get page title
- `playwright_query_selector` - Query element
- `playwright_query_selector_all` - Query multiple
- `playwright_get_cookies` - Get cookies
- `playwright_add_cookies` - Add cookies

**Waiting** (4 tools):
- `playwright_wait_for_selector` - Wait for element
- `playwright_wait_for_navigation` - Wait for nav
- `playwright_wait_for_load_state` - Wait for load
- `playwright_wait_for_timeout` - Wait duration

**Session** (5 tools):
- `playwright_create_context` - New context
- `playwright_close_context` - Close context
- `playwright_new_page` - New page
- `playwright_close_page` - Close page
- `playwright_clear_cookies` - Clear cookies

**Total**: 40+ tools available

## For Different Roles

### QA Engineer
1. Read: `/Users/iroselli/wundr/docs/PLAYWRIGHT_MCP_GUIDE.md`
2. Use: Test template helper functions
3. Create: Test cases for features
4. Run: `npm run test`

### Test Automation Engineer
1. Study: Commands reference & patterns
2. Review: Page validation test file
3. Implement: Automated test suites
4. Integrate: Into CI/CD pipeline

### Frontend Engineer
1. Navigate: To implemented pages
2. Test: Form inputs and interactions
3. Verify: Error states
4. Capture: Screenshots for comparison

### Backend Engineer
1. Navigate: Through UI features
2. Verify: API data displayed correctly
3. Test: Integration points
4. Validate: State persistence

### DevOps Engineer
1. Configure: GitHub Actions workflow
2. Integrate: Test execution in CI/CD
3. Monitor: Test results
4. Report: Coverage metrics

## Integration with SPARC

```bash
# Specification phase
npx claude-flow sparc run spec-pseudocode "Create test spec using Playwright"

# Refinement phase (TDD)
npx claude-flow sparc tdd "Implement login tests with Playwright"

# Integration phase
npx claude-flow sparc run integration "Add tests to CI/CD pipeline"
```

## Integration with GitHub Actions

```yaml
name: Playwright Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run dev &
      - run: sleep 10
      - run: npm run test:playwright
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: screenshots
          path: screenshots/
```

## Troubleshooting

### MCP Not Connected
```bash
claude mcp remove playwright
claude mcp add playwright npx @executeautomation/playwright-mcp-server
claude mcp list
```

### Dev Server Not Responding
```bash
cd /Users/iroselli/wundr/packages/@wundr/neolith/apps/web
npm run dev
# Wait 10-15 seconds
curl http://localhost:3000
```

### Tests Timing Out
```bash
# Increase timeout
mcp_tool__playwright_wait_for_selector {
  selector: ".element",
  timeout: 30000
}

# Or use load state
mcp_tool__playwright_wait_for_load_state { state: "networkidle" }
```

### Element Not Found
```bash
# Check if selector exists
mcp_tool__playwright_query_selector { selector: ".my-element" }

# Try alternative
mcp_tool__playwright_query_selector { selector: "[data-testid='element']" }

# Debug HTML
mcp_tool__playwright_get_html { selector: "body" }
```

## Common Patterns

### Pattern 1: Simple Page Load
```bash
mcp_tool__playwright_navigate { url: "http://localhost:3000/page" }
mcp_tool__playwright_wait_for_selector { selector: ".content" }
mcp_tool__playwright_screenshot { path: "screenshots/page.png" }
```

### Pattern 2: Form Submission
```bash
mcp_tool__playwright_navigate { url: "http://localhost:3000/form" }
mcp_tool__playwright_fill { selector: "input[name='field']", value: "value" }
mcp_tool__playwright_click { selector: "button[type='submit']" }
mcp_tool__playwright_wait_for_navigation
```

### Pattern 3: Multi-Step Flow
```bash
# Step 1
mcp_tool__playwright_navigate { url: "..." }
mcp_tool__playwright_wait_for_selector { selector: ".start" }

# Step 2
mcp_tool__playwright_click { selector: ".button" }
mcp_tool__playwright_wait_for_selector { selector: ".step2" }

# Step 3
mcp_tool__playwright_fill { selector: "input", value: "data" }
mcp_tool__playwright_click { selector: ".submit" }
mcp_tool__playwright_screenshot { path: "final.png" }
```

## File Locations (Summary)

```
Documentation:
├── PLAYWRIGHT_MCP_SETUP_COMPLETE.md (start here)
├── PLAYWRIGHT_MCP_GUIDE.md (tools & setup)
├── PLAYWRIGHT_MCP_COMMANDS.md (commands reference)
└── PLAYWRIGHT_MCP_AGENT_WORKFLOW.md (role guides)

Test Resources:
├── playwright-mcp-test-template.ts (helpers)
└── neolith-page-validation.test.ts (page list)

Config:
└── /Users/iroselli/.claude.json (MCP config)
```

## Performance Tips

1. **Reuse contexts** - Create once, use multiple times
2. **Minimize screenshots** - Only capture when needed
3. **Use smart waits** - Specific conditions, not sleep
4. **Batch operations** - Group related actions
5. **Run in parallel** - Independent tests concurrently

## Next Steps

1. Review the setup documentation
2. Study test template examples
3. Create first test case
4. Execute with Playwright MCP
5. Integrate into CI/CD pipeline
6. Generate coverage reports

## Support

For detailed information, refer to:
- **Playwright MCP Guide**: Setup & available tools
- **Commands Reference**: 50+ command examples
- **Agent Workflow**: Role-specific instructions
- **Test Template**: Ready-to-use helper functions
- **Playwright Docs**: https://playwright.dev/

---

**Installation**: COMPLETE
**Status**: READY FOR USE
**MCP Connection**: ACTIVE
**Dev Server**: RUNNING
**Pages Covered**: 24/24 (100%)

Ready to start automated browser testing!
