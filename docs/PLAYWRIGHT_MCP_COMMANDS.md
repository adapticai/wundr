# Playwright MCP - Complete Command Reference

## Quick Reference: All Available Commands

### Session & Context Management

```bash
# Create new browser context
mcp_tool__playwright_create_context

# Close browser context
mcp_tool__playwright_close_context { contextId: "ctx-123" }

# Create new page
mcp_tool__playwright_new_page { contextId: "ctx-123" }

# Close page
mcp_tool__playwright_close_page { pageId: "page-123" }
```

### Navigation

```bash
# Navigate to URL
mcp_tool__playwright_navigate { url: "http://localhost:3000/login" }

# Go to URL with options
mcp_tool__playwright_goto {
  url: "http://localhost:3000/dashboard",
  waitUntil: "networkidle"
}

# Back button
mcp_tool__playwright_back

# Forward button
mcp_tool__playwright_forward

# Reload page
mcp_tool__playwright_reload { waitUntil: "domcontentloaded" }
```

### Element Interaction

```bash
# Click element
mcp_tool__playwright_click { selector: "button.login-button" }

# Fill input
mcp_tool__playwright_fill {
  selector: "input[name='email']",
  value: "user@example.com"
}

# Type text (character by character)
mcp_tool__playwright_type {
  selector: "input[name='password']",
  text: "SecurePassword123"
}

# Select dropdown option
mcp_tool__playwright_select {
  selector: "select[name='role']",
  option: "admin"
}

# Check checkbox
mcp_tool__playwright_check { selector: "input[type='checkbox']" }

# Uncheck checkbox
mcp_tool__playwright_uncheck { selector: "input[type='checkbox']" }

# Press key
mcp_tool__playwright_press {
  selector: "input",
  key: "Enter"
}
```

### Information Retrieval

```bash
# Get current URL
mcp_tool__playwright_get_url

# Get page title
mcp_tool__playwright_get_title

# Get element text
mcp_tool__playwright_get_text { selector: "h1" }

# Get element HTML
mcp_tool__playwright_get_html { selector: ".card" }

# Query single element
mcp_tool__playwright_query_selector { selector: ".navbar" }

# Query multiple elements
mcp_tool__playwright_query_selector_all { selector: ".list-item" }

# Take screenshot
mcp_tool__playwright_screenshot { path: "screenshots/login.png" }

# Full page screenshot
mcp_tool__playwright_screenshot {
  path: "screenshots/full-page.png",
  fullPage: true
}
```

### Waiting & Synchronization

```bash
# Wait for selector
mcp_tool__playwright_wait_for_selector {
  selector: ".modal",
  timeout: 5000
}

# Wait for navigation
mcp_tool__playwright_wait_for_navigation { timeout: 10000 }

# Wait for load state
mcp_tool__playwright_wait_for_load_state { state: "networkidle" }

# Wait for timeout
mcp_tool__playwright_wait_for_timeout { ms: 2000 }
```

### Cookies & Storage

```bash
# Get cookies
mcp_tool__playwright_get_cookies

# Add cookies
mcp_tool__playwright_add_cookies {
  cookies: [
    {
      name: "session_id",
      value: "abc123def456",
      domain: "localhost",
      path: "/"
    }
  ]
}

# Clear cookies
mcp_tool__playwright_clear_cookies
```

---

## Real-World Usage Examples

### Example 1: Login Flow

```bash
# Navigate to login page
mcp_tool__playwright_navigate { url: "http://localhost:3000/login" }

# Wait for form to appear
mcp_tool__playwright_wait_for_selector { selector: "form" }

# Fill email
mcp_tool__playwright_fill {
  selector: "input[name='email']",
  value: "user@adaptic.ai"
}

# Fill password
mcp_tool__playwright_fill {
  selector: "input[name='password']",
  value: "SecurePass123!"
}

# Click login button
mcp_tool__playwright_click { selector: "button[type='submit']" }

# Wait for navigation to dashboard
mcp_tool__playwright_wait_for_navigation { timeout: 10000 }

# Verify we're on dashboard
mcp_tool__playwright_get_url
# Expected output: http://localhost:3000/[workspaceId]/dashboard

# Take screenshot
mcp_tool__playwright_screenshot { path: "screenshots/dashboard.png" }
```

### Example 2: Form Validation Testing

```bash
# Navigate to registration form
mcp_tool__playwright_navigate { url: "http://localhost:3000/register" }

# Try submitting empty form
mcp_tool__playwright_click { selector: "button[type='submit']" }

# Check for error messages
mcp_tool__playwright_wait_for_selector { selector: ".error-message" }

# Get error text
mcp_tool__playwright_get_text { selector: ".error-message" }

# Fill email field
mcp_tool__playwright_fill {
  selector: "input[name='email']",
  value: "test@adaptic.ai"
}

# Fill password
mcp_tool__playwright_fill {
  selector: "input[name='password']",
  value: "ValidPassword123!"
}

# Fill confirm password
mcp_tool__playwright_fill {
  selector: "input[name='confirmPassword']",
  value: "ValidPassword123!"
}

# Submit form
mcp_tool__playwright_click { selector: "button[type='submit']" }

# Wait for success
mcp_tool__playwright_wait_for_navigation { timeout: 10000 }
```

### Example 3: Dashboard Navigation

```bash
# Navigate to dashboard
mcp_tool__playwright_navigate {
  url: "http://localhost:3000/test-workspace-001/dashboard"
}

# Wait for page load
mcp_tool__playwright_wait_for_load_state { state: "networkidle" }

# Click on Agents menu item
mcp_tool__playwright_click { selector: "a[href*='/agents']" }

# Wait for agents page
mcp_tool__playwright_wait_for_selector { selector: ".agents-list" }

# Get all agent names
mcp_tool__playwright_query_selector_all { selector: ".agent-card h3" }

# Navigate to specific agent
mcp_tool__playwright_click { selector: ".agent-card:first-child" }

# Wait for agent details
mcp_tool__playwright_wait_for_load_state { state: "networkidle" }

# Get agent details
mcp_tool__playwright_get_text { selector: ".agent-name" }

# Take screenshot
mcp_tool__playwright_screenshot { path: "screenshots/agent-details.png" }
```

### Example 4: Modal Interaction

```bash
# Navigate to settings
mcp_tool__playwright_navigate {
  url: "http://localhost:3000/test-workspace-001/settings/profile"
}

# Click edit button
mcp_tool__playwright_click { selector: "button[data-testid='edit-profile']" }

# Wait for modal
mcp_tool__playwright_wait_for_selector { selector: "[role='dialog']" }

# Fill form field
mcp_tool__playwright_fill {
  selector: "input[name='displayName']",
  value: "John Doe"
}

# Select role from dropdown
mcp_tool__playwright_select {
  selector: "select[name='role']",
  option: "admin"
}

# Click save button
mcp_tool__playwright_click { selector: "button[data-testid='save']" }

# Wait for modal to close
mcp_tool__playwright_wait_for_selector {
  selector: "[role='dialog']",
  timeout: 3000,
  state: "hidden"
}

# Verify changes
mcp_tool__playwright_get_text { selector: ".profile-name" }
```

### Example 5: List/Table Operations

```bash
# Navigate to members page
mcp_tool__playwright_navigate {
  url: "http://localhost:3000/test-workspace-001/admin/members"
}

# Wait for table to load
mcp_tool__playwright_wait_for_selector { selector: "table tbody" }

# Get all member rows
mcp_tool__playwright_query_selector_all { selector: "table tbody tr" }

# Get member count
mcp_tool__playwright_query_selector_all { selector: "table tbody tr" }
# Count the returned elements

# Click on first member
mcp_tool__playwright_click { selector: "table tbody tr:first-child" }

# Get member name
mcp_tool__playwright_get_text { selector: ".member-name" }

# Find member by name using filter
mcp_tool__playwright_query_selector_all { selector: ".member-card" }
# Then identify by content

# Click action button for member
mcp_tool__playwright_click { selector: ".member-card:nth-child(2) button[data-action='edit']" }
```

### Example 6: Workspace Creation Flow

```bash
# Navigate to dashboard
mcp_tool__playwright_navigate { url: "http://localhost:3000/dashboard" }

# Wait for page
mcp_tool__playwright_wait_for_load_state { state: "networkidle" }

# Click "Create Workspace" button
mcp_tool__playwright_click { selector: "button:has-text('Create Workspace')" }

# Wait for modal
mcp_tool__playwright_wait_for_selector { selector: "[role='dialog']" }

# Fill workspace name
mcp_tool__playwright_fill {
  selector: "input[placeholder='Workspace name']",
  value: "Engineering Team"
}

# Fill description
mcp_tool__playwright_fill {
  selector: "textarea[placeholder='Workspace description']",
  value: "Workspace for the engineering team"
}

# Select plan (if applicable)
mcp_tool__playwright_select {
  selector: "select[name='plan']",
  option: "pro"
}

# Accept terms checkbox
mcp_tool__playwright_check { selector: "input[name='acceptTerms']" }

# Submit form
mcp_tool__playwright_click { selector: "button[type='submit']" }

# Wait for redirect
mcp_tool__playwright_wait_for_navigation { timeout: 10000 }

# Verify new workspace
mcp_tool__playwright_get_url
# Expected: Contains /[new-workspace-id]/dashboard

# Take screenshot
mcp_tool__playwright_screenshot { path: "screenshots/new-workspace.png" }
```

---

## Testing Patterns & Best Practices

### Pattern 1: Setup & Verification

```bash
# 1. Setup
mcp_tool__playwright_navigate { url: "http://localhost:3000/login" }
mcp_tool__playwright_wait_for_selector { selector: "form" }

# 2. Action
mcp_tool__playwright_fill { selector: "input[name='email']", value: "test@test.com" }
mcp_tool__playwright_click { selector: "button[type='submit']" }

# 3. Verification
mcp_tool__playwright_wait_for_navigation { timeout: 10000 }
mcp_tool__playwright_get_url
mcp_tool__playwright_screenshot { path: "screenshots/verify.png" }
```

### Pattern 2: Conditional Navigation

```bash
# Check if element exists
mcp_tool__playwright_query_selector { selector: ".error-message" }

# If error exists, capture it
mcp_tool__playwright_get_text { selector: ".error-message" }

# Otherwise, continue
mcp_tool__playwright_get_url
```

### Pattern 3: Sequential Actions

```bash
# 1. Navigate
mcp_tool__playwright_navigate { url: "http://localhost:3000/agents" }

# 2. Wait for load
mcp_tool__playwright_wait_for_load_state { state: "networkidle" }

# 3. Get list
mcp_tool__playwright_query_selector_all { selector: ".agent-item" }

# 4. Click first item
mcp_tool__playwright_click { selector: ".agent-item:first-child" }

# 5. Verify navigation
mcp_tool__playwright_wait_for_load_state { state: "networkidle" }
mcp_tool__playwright_get_url
```

---

## Command Parameters Reference

### Common Parameters

| Parameter   | Type   | Description   | Example                                         |
| ----------- | ------ | ------------- | ----------------------------------------------- |
| `selector`  | string | CSS selector  | `".button"`, `"input[name='email']"`            |
| `url`       | string | Full URL      | `"http://localhost:3000/login"`                 |
| `value`     | string | Input value   | `"user@example.com"`                            |
| `timeout`   | number | Milliseconds  | `5000`                                          |
| `waitUntil` | string | Load state    | `"networkidle"`, `"load"`, `"domcontentloaded"` |
| `path`      | string | File path     | `"./screenshots/test.png"`                      |
| `state`     | string | Element state | `"visible"`, `"hidden"`, `"attached"`           |

### Wait States

| State              | Behavior                      |
| ------------------ | ----------------------------- |
| `domcontentloaded` | DOM is fully loaded           |
| `load`             | Page load event fired         |
| `networkidle`      | No network activity for 500ms |

---

## Error Handling

### Common Errors & Solutions

#### "Timeout waiting for selector"

```bash
# Increase timeout
mcp_tool__playwright_wait_for_selector {
  selector: ".slow-element",
  timeout: 30000  # 30 seconds
}
```

#### "Element not found"

```bash
# Check selector first
mcp_tool__playwright_query_selector { selector: ".element" }

# Try alternative selector
mcp_tool__playwright_query_selector { selector: "[data-testid='element']" }
```

#### "Navigation failed"

```bash
# Wait for load state first
mcp_tool__playwright_wait_for_load_state { state: "networkidle" }

# Then navigate
mcp_tool__playwright_goto { url: "http://localhost:3000/new-page" }
```

#### "Cookie/Session expired"

```bash
# Clear and re-authenticate
mcp_tool__playwright_clear_cookies

# Re-login
mcp_tool__playwright_navigate { url: "http://localhost:3000/login" }
# ... login flow ...
```

---

## Performance Tips

1. **Batch Operations**: Group related actions together
2. **Use Specific Selectors**: Prefer `[data-testid]` over class names
3. **Minimize Screenshots**: Only capture when necessary
4. **Reuse Contexts**: Create once, use multiple times
5. **Smart Waits**: Use appropriate wait states

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Run Playwright MCP Tests
  run: |
    npm run dev &
    sleep 10  # Wait for server
    npm run test:playwright
```

### Environment Variables

```bash
# .env.test
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_SLOW_MO=100
DEBUG=pw:api
```

---

## Neolith-Specific Selectors

### Authentication Form

```
email input: input[name='email']
password input: input[name='password']
login button: button[type='submit']
register link: a[href='/register']
```

### Dashboard Navigation

```
sidebar: .sidebar
main nav: .main-navigation
user menu: .user-menu
logout button: button[data-testid='logout']
```

### Common Components

```
modal: [role='dialog']
button: button, [role='button']
link: a[href*='/']
form: form, [role='form']
```

---

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [CSS Selectors](https://www.w3schools.com/cssref/selectors.asp)
- [ExecuteAutomation Playwright MCP](https://github.com/executeautomation/playwright-mcp-server)

---

**Last Updated**: 2025-11-26 **Playwright MCP Version**: Latest
(@executeautomation/playwright-mcp-server) **Status**: Connected and Ready
