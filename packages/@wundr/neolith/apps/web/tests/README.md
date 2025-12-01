# Playwright E2E Tests - Dashboard

This directory contains end-to-end tests for the Neolith web application, with comprehensive
coverage of the dashboard functionality.

## Prerequisites

1. **Environment Setup**: Ensure you have test credentials configured
2. **Development Server**: The app should be running on `http://localhost:3000`
3. **Playwright Installed**: Run `npm install` to install Playwright dependencies

## Test Files

### Authentication Setup

**File**: `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/auth.setup.ts`

This setup file creates an authenticated session that's reused across all tests. It:

- Logs in with test credentials
- Waits for successful redirect to dashboard
- Saves authentication state to `playwright/.auth/user.json`

### Dashboard Tests

**File**: `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/dashboard.spec.ts`

Comprehensive test suite covering:

#### 1. Authentication & Access Control

- Dashboard loads when authenticated
- Displays authenticated user information
- Has valid session cookies
- Redirects to login when session expires

#### 2. Quick Stats Widget

- Displays all four stat items (Team Members, Channels, Workflows, Orchestrators)
- Shows numeric values correctly
- Handles zero values
- Shows loading skeleton
- Handles API errors gracefully

#### 3. Recent Activity Widget

- Displays recent activity heading
- Shows activity items when data exists
- Shows empty state when no activity
- Formats relative timestamps correctly
- Limits displayed items to 4
- Handles API errors

#### 4. Quick Actions

- Displays all action buttons
- Has chevron icons on buttons
- Navigates correctly on click:
  - Invite Team Member → `/admin/members`
  - Create Channel → `/channels`
  - New Workflow → `/workflows`
  - View Activity → `/admin/activity`
- Shows hover effects

#### 5. Sidebar Navigation

- Displays all navigation items
- Highlights active navigation item
- Navigates to different pages
- Shows workspace name
- Shows user section at bottom
- Shows online status indicator

#### 6. Theme Toggle

- Displays theme toggle button
- Toggles between light and dark themes
- Persists theme preference across reloads

#### 7. User Menu

- Displays user menu button
- Opens menu on click
- Shows user information in menu
- Has sign out option
- Navigates to settings

#### 8. Workspace Switcher

- Displays workspace switcher (if multiple workspaces)
- Shows current workspace name
- Opens workspace dropdown
- Lists available workspaces
- Switches workspace when selected

#### 9. Performance Tests

- Page loads within 3 seconds
- Stats API completes within 2 seconds
- No layout shift (CLS < 0.1)

#### 10. Accessibility

- Supports keyboard navigation
- Has proper focus indicators
- Has aria-labels on interactive elements
- Maintains sufficient color contrast

## Configuration

### Environment Variables

Create a `.env.test` file with:

```bash
# Test user credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123

# Base URL (optional - defaults to http://localhost:3000)
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

### Playwright Config

The `playwright.config.ts` includes:

- Setup project that runs before all tests
- Storage state reuse for authentication
- Auto-start dev server
- Screenshot on failure
- Trace on first retry

## Running Tests

### Run All Tests

```bash
npm run test:e2e
```

Or directly with Playwright:

```bash
npx playwright test
```

### Run Specific Test File

```bash
npx playwright test dashboard.spec.ts
```

### Run Specific Test Suite

```bash
npx playwright test dashboard.spec.ts -g "Quick Stats"
```

### Run in UI Mode (Interactive)

```bash
npx playwright test --ui
```

### Run in Debug Mode

```bash
npx playwright test --debug
```

### Run Setup Only

```bash
npx playwright test auth.setup.ts --project=setup
```

### Generate Authentication State Manually

If you need to regenerate the auth state:

```bash
npx playwright test auth.setup.ts --project=setup
```

This creates `playwright/.auth/user.json` with session cookies.

## Viewing Results

### HTML Report

After tests run, view the HTML report:

```bash
npx playwright show-report
```

### Traces

If a test fails on first retry, a trace is captured. View it:

```bash
npx playwright show-trace trace.zip
```

## Test Organization

```
tests/
├── auth.setup.ts              # Authentication setup (runs first)
├── dashboard.spec.ts          # Dashboard tests (main suite)
├── channels-page-test.spec.ts # Channel page tests
├── deployments-page.spec.ts   # Deployments page tests
└── README.md                  # This file

playwright/
└── .auth/
    └── user.json              # Saved authentication state
```

## Authentication Flow

### How It Works

1. **Setup Phase** (`auth.setup.ts`):
   - Runs before all test projects
   - Navigates to login page
   - Fills credentials from environment variables
   - Submits login form
   - Waits for redirect to dashboard
   - Saves cookies/session to `user.json`

2. **Test Phase** (`dashboard.spec.ts`):
   - Uses `test.use({ storageState: 'user.json' })`
   - All tests start with authenticated session
   - No need to login again in each test
   - Session persists across all tests

### Advantages

- **Fast**: Login once, reuse across all tests
- **Reliable**: No repeated authentication failures
- **Clean**: Tests focus on functionality, not authentication
- **Maintainable**: Change login logic in one place

## Troubleshooting

### Authentication Fails

If auth setup fails:

1. Check test credentials in `.env.test`
2. Verify dev server is running
3. Check login page URL matches app configuration
4. Run setup in debug mode:
   ```bash
   npx playwright test auth.setup.ts --project=setup --debug
   ```

### Tests Fail Due to Session Expiration

If tests fail with redirect to login:

1. Regenerate auth state:
   ```bash
   npx playwright test auth.setup.ts --project=setup
   ```
2. Check session timeout in auth config
3. Verify cookies are being saved correctly

### Slow Tests

If tests are slow:

1. Check network throttling is disabled
2. Reduce `waitForTimeout` values
3. Use `waitForLoadState('domcontentloaded')` instead of `'networkidle'`
4. Mock slow API endpoints

### Flaky Tests

If tests are inconsistent:

1. Increase timeout values for slow elements
2. Use `waitFor` instead of fixed timeouts
3. Add retries in config: `retries: 2`
4. Check for race conditions in async operations

## Best Practices

1. **Use Storage State**: Reuse authentication across tests
2. **Wait for Elements**: Use `waitFor` instead of `waitForTimeout`
3. **Specific Selectors**: Use data-testid or aria-labels
4. **Independent Tests**: Each test should work in isolation
5. **Mock APIs**: Use route mocking for predictable tests
6. **Error Handling**: Handle optional elements gracefully

## CI/CD Integration

For GitHub Actions or similar:

```yaml
- name: Install Playwright Browsers
  run: npx playwright install --with-deps

- name: Run Playwright tests
  run: npm run test:e2e
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}

- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## Adding New Tests

To add new dashboard tests:

1. Open `dashboard.spec.ts`
2. Add new `test.describe()` block
3. Write test cases using existing patterns
4. Run tests to verify
5. Update this README with new test coverage

## Support

For issues or questions:

- Check Playwright docs: https://playwright.dev
- Review existing test patterns
- Run tests in UI mode for debugging
- Enable trace for detailed execution logs
