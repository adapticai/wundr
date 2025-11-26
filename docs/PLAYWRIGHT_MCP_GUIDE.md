# Playwright MCP Server - Configuration & Usage Guide

## Installation & Setup

### Current Configuration
- **Package**: `@executeautomation/playwright-mcp-server`
- **Status**: Connected and Ready
- **Server Type**: stdio

### Quick Start

```bash
# Verify Playwright MCP is installed
claude mcp list

# Expected output:
# playwright: npx @executeautomation/playwright-mcp-server - ✓ Connected
```

### Configuration Location
- Config file: `/Users/iroselli/.claude.json`
- Server command: `npx @executeautomation/playwright-mcp-server`

---

## Available MCP Tools

The Playwright MCP server provides browser automation tools:

### Navigation Tools
- `playwright_navigate` - Navigate to URL
- `playwright_goto` - Go to URL with options
- `playwright_back` - Navigate back
- `playwright_forward` - Navigate forward
- `playwright_reload` - Reload page

### Interaction Tools
- `playwright_click` - Click element by selector
- `playwright_fill` - Fill form input
- `playwright_type` - Type text
- `playwright_select` - Select dropdown option
- `playwright_check` - Check checkbox
- `playwright_uncheck` - Uncheck checkbox
- `playwright_press` - Press keyboard key

### Information Tools
- `playwright_screenshot` - Capture screenshot
- `playwright_get_text` - Get element text
- `playwright_get_html` - Get element HTML
- `playwright_get_url` - Get current URL
- `playwright_get_title` - Get page title
- `playwright_query_selector` - Query element
- `playwright_query_selector_all` - Query multiple elements

### Wait Tools
- `playwright_wait_for_selector` - Wait for element
- `playwright_wait_for_navigation` - Wait for navigation
- `playwright_wait_for_load_state` - Wait for load state
- `playwright_wait_for_timeout` - Wait for duration

### Session Management
- `playwright_create_context` - Create browser context
- `playwright_close_context` - Close context
- `playwright_new_page` - Create new page
- `playwright_close_page` - Close page
- `playwright_get_cookies` - Get cookies
- `playwright_add_cookies` - Add cookies
- `playwright_clear_cookies` - Clear cookies

---

## Neolith Application Structure

### Available Routes (23 Pages + Index)

#### Authentication Routes
- `/` - Home page (redirects to /login)
- `/login` - User login
- `/register` - User registration
- `/error` - Error page

#### Workspace Routes (Dynamic ID Required)
- `/[workspaceId]/dashboard` - Workspace dashboard
- `/[workspaceId]/agents` - AI agents management
- `/[workspaceId]/workflows` - Workflow management
- `/[workspaceId]/vps` - Virtual Personalities list
- `/[workspaceId]/vps/[vpId]` - Virtual Personality details
- `/[workspaceId]/channels/[channelId]` - Channel details
- `/[workspaceId]/channels/[channelId]/settings` - Channel settings
- `/[workspaceId]/call/[callId]` - Call details
- `/[workspaceId]/deployments` - Deployment management
- `/[workspaceId]/analytics` - Analytics dashboard

#### Admin Routes
- `/[workspaceId]/admin` - Admin overview
- `/[workspaceId]/admin/members` - Member management
- `/[workspaceId]/admin/roles` - Role management
- `/[workspaceId]/admin/billing` - Billing information
- `/[workspaceId]/admin/activity` - Activity logs
- `/[workspaceId]/admin/settings` - Admin settings
- `/[workspaceId]/admin/vp-health` - VP health monitoring

#### User Settings Routes
- `/[workspaceId]/settings/profile` - Profile settings
- `/[workspaceId]/settings/integrations` - Integration settings
- `/[workspaceId]/user-settings/notifications` - Notification preferences

---

## Test Script Template

### Basic Test Structure

```typescript
// tests/playwright-mcp.test.ts
import { describe, it, beforeEach } from '@jest/globals';

describe('Playwright MCP Browser Automation', () => {
  beforeEach(async () => {
    // Initialize before each test
    console.log('Setting up test environment...');
  });

  it('should navigate to login page', async () => {
    // Navigate to localhost:3000/login
    // Verify page loads successfully
    // Check for login form elements
  });

  it('should interact with form elements', async () => {
    // Fill email input
    // Fill password input
    // Click login button
    // Wait for navigation
  });

  it('should capture screenshots', async () => {
    // Navigate to page
    // Take screenshot
    // Verify screenshot created
  });
});
```

---

## Common Workflows

### Workflow 1: Page Navigation
```
1. playwright_navigate("http://localhost:3000/login")
2. playwright_wait_for_selector(".login-form")
3. playwright_screenshot()
4. playwright_get_title()
```

### Workflow 2: Form Submission
```
1. playwright_navigate("http://localhost:3000/login")
2. playwright_fill("input[name='email']", "test@example.com")
3. playwright_fill("input[name='password']", "password123")
4. playwright_click("button[type='submit']")
5. playwright_wait_for_navigation()
6. playwright_screenshot()
```

### Workflow 3: UI Element Interaction
```
1. playwright_navigate("http://localhost:3000/[workspaceId]/dashboard")
2. playwright_click("button.menu-trigger")
3. playwright_wait_for_selector(".menu-content")
4. playwright_get_text(".menu-content")
5. playwright_screenshot()
```

### Workflow 4: Data Extraction
```
1. playwright_navigate("http://localhost:3000/[workspaceId]/agents")
2. playwright_query_selector_all(".agent-card")
3. playwright_get_html(".agent-list")
4. playwright_screenshot()
```

---

## Error Handling

### Common Issues & Solutions

#### Issue: Navigation Timeout
**Cause**: Page takes too long to load
**Solution**: Use `playwright_wait_for_load_state("networkidle")`

#### Issue: Element Not Found
**Cause**: Selector incorrect or element not rendered
**Solution**: Use `playwright_query_selector()` first to verify element exists

#### Issue: Context Lost
**Cause**: Browser context closed unexpectedly
**Solution**: Use `playwright_create_context()` to initialize fresh context

#### Issue: Cookie/Session Issues
**Cause**: Missing authentication cookies
**Solution**: Use `playwright_add_cookies()` to set cookies before navigation

---

## Performance Tips

1. **Reuse Contexts**: Create once, use multiple times
2. **Minimize Wait Times**: Use specific wait conditions instead of sleep
3. **Batch Operations**: Group related actions together
4. **Screenshot Strategically**: Only capture when necessary
5. **Parallel Testing**: Run independent tests concurrently

---

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Playwright MCP Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run dev &
      - run: npm run test:playwright
```

---

## Troubleshooting

### Verify Installation
```bash
claude mcp list | grep playwright
# Should show: playwright: npx @executeautomation/playwright-mcp-server - ✓ Connected
```

### Check Server Health
```bash
npx @executeautomation/playwright-mcp-server --version
```

### Debug Mode
Enable verbose logging:
```bash
DEBUG=playwright:* npm run test
```

---

## Best Practices

1. **Use Semantic Selectors**: Prefer `data-testid` over class names
2. **Wait for Load States**: Use `networkidle` or `domcontentloaded`
3. **Isolate Tests**: Each test should be independent
4. **Clean Up**: Always close contexts/pages after tests
5. **Meaningful Assertions**: Check both presence and visibility
6. **Screenshots for Debugging**: Capture on failure
7. **Document Test Purpose**: Use clear test names and comments

---

## Reference

- [Playwright Documentation](https://playwright.dev/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [ExecuteAutomation Playwright MCP](https://github.com/executeautomation/playwright-mcp-server)

---

## Support & Contributing

For issues or feature requests:
1. Check this guide first
2. Review Playwright documentation
3. Open an issue with reproduction steps
4. Include screenshots/logs when reporting bugs

---

**Last Updated**: 2025-11-26
**Playwright MCP Status**: Connected and Ready
**Neolith Dev Server**: Running on http://localhost:3000
