# Authentication Testing Guide

This guide covers the comprehensive authentication test suite for the Neolith web application.

## Test Files

### Main Test Suite
- **`auth.spec.ts`** - Complete authentication flow tests (600+ lines, 50+ test cases)

### Test Utilities
- **`fixtures/auth.ts`** - Authentication fixtures, helpers, and mock data

## Test Coverage

The authentication test suite covers:

### Login Page (12 tests)
- ✅ Page loads correctly with all elements
- ✅ OAuth provider buttons with icons
- ✅ Form validation (empty fields, invalid email)
- ✅ Invalid credentials error handling
- ✅ Loading states and disabled inputs
- ✅ Navigation to forgot password and register
- ✅ Autocomplete attributes
- ✅ Error message clearing

### Register Page (10 tests)
- ✅ Page loads with all required fields
- ✅ Required field validation
- ✅ Email format validation
- ✅ Password length validation (min 8 characters)
- ✅ Password matching validation
- ✅ Existing email error handling
- ✅ Loading states
- ✅ Navigation to login
- ✅ Autocomplete attributes

### Forgot Password Page (9 tests)
- ✅ Page loads correctly
- ✅ Email field validation
- ✅ Email format validation
- ✅ Success message display
- ✅ Form hiding after submission
- ✅ Loading states
- ✅ Navigation links
- ✅ Autofocus on email input

### Reset Password Page (8 tests)
- ✅ Page loads with token
- ✅ Error when no token provided
- ✅ Password strength indicator
- ✅ Dynamic strength updates
- ✅ Password matching validation
- ✅ Minimum length validation
- ✅ Complexity requirements
- ✅ Navigation to login

### Logout Functionality (1 test)
- ✅ Logout redirects to login page

### Protected Routes (6 tests)
- ✅ Dashboard requires authentication
- ✅ Workspace routes require authentication
- ✅ Settings require authentication
- ✅ Admin routes require authentication
- ✅ VPs require authentication
- ✅ Workflows require authentication

### OAuth Flows (3 tests)
- ✅ GitHub OAuth initialization
- ✅ Google OAuth initialization
- ✅ OAuth button disabled states

### Session Management (2 tests)
- ✅ Session persistence across refreshes
- ✅ Expired session handling

### Accessibility & UX (5 tests)
- ✅ Keyboard navigation
- ✅ Enter key form submission
- ✅ ARIA labels and roles
- ✅ Password visibility toggle
- ✅ Focus management

### Error Handling (2 tests)
- ✅ Network error handling
- ✅ API error messages

### Mobile Responsiveness (3 tests)
- ✅ Mobile layout rendering
- ✅ Touch target sizes
- ✅ No horizontal scroll

## Running the Tests

### Run all auth tests
```bash
npx playwright test auth.spec.ts
```

### Run specific test suite
```bash
npx playwright test auth.spec.ts -g "Login Page"
npx playwright test auth.spec.ts -g "Register Page"
npx playwright test auth.spec.ts -g "Protected Routes"
```

### Run in headed mode (see browser)
```bash
npx playwright test auth.spec.ts --headed
```

### Run in debug mode
```bash
npx playwright test auth.spec.ts --debug
```

### Run with specific browser
```bash
npx playwright test auth.spec.ts --project=chromium
npx playwright test auth.spec.ts --project=firefox
npx playwright test auth.spec.ts --project=webkit
```

### Generate HTML report
```bash
npx playwright test auth.spec.ts --reporter=html
npx playwright show-report
```

## Using Authentication Fixtures

### Basic Usage

```typescript
import { test, expect } from './fixtures/auth';

test.describe('Authenticated Tests', () => {
  test('access dashboard as authenticated user', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await expect(authenticatedPage).toHaveURL(/\/dashboard/);
  });

  test('access admin panel as admin', async ({ adminPage }) => {
    await adminPage.goto('/admin/members');
    await expect(adminPage).toHaveURL(/\/admin\/members/);
  });

  test('access Orchestrator features', async ({ vpPage }) => {
    await vpPage.goto('/orchestrators');
    await expect(vpPage).toHaveURL(/\/orchestrators/);
  });
});
```

### Custom User Authentication

```typescript
import { test, TEST_USER, ADMIN_USER } from './fixtures/auth';

test('login as specific user', async ({ page, loginAsUser }) => {
  // Login as admin
  await loginAsUser(ADMIN_USER);
  await page.goto('/admin');

  // Logout and login as regular user
  await logout(page);
  await loginAsUser(TEST_USER);
  await page.goto('/dashboard');
});
```

### UI-Based Login (More Realistic)

```typescript
import { test, loginViaUI } from './fixtures/auth';

test('login via UI', async ({ page }) => {
  await loginViaUI(page, {
    email: 'test@example.com',
    password: 'Password123!',
  });

  // Now authenticated via the actual login form
  await expect(page).toHaveURL(/\/dashboard/);
});
```

### Mock API Responses

```typescript
import { test, setupAuthMocks } from './fixtures/auth';

test('test login failure', async ({ page }) => {
  await setupAuthMocks(page, {
    loginSucceeds: false,
  });

  await page.goto('/login');
  await page.getByPlaceholder(/email/i).fill('test@example.com');
  await page.getByPlaceholder(/password/i).fill('wrong');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByText(/invalid/i)).toBeVisible();
});
```

## Test Data

### Default Test Users

```typescript
// Regular user
TEST_USER = {
  email: 'test@neolith.dev',
  password: 'TestPassword123!',
  name: 'Test User',
  role: 'MEMBER',
}

// Admin user
ADMIN_USER = {
  email: 'admin@neolith.dev',
  password: 'AdminPassword123!',
  name: 'Admin User',
  role: 'ADMIN',
}

// Orchestrator
VP_USER = {
  email: 'vp@neolith.dev',
  password: 'VPPassword123!',
  name: 'Test VP',
  role: 'MEMBER',
  isVP: true,
  vpId: 'test-orchestrator-123',
}
```

## Configuration

### Environment Variables

```bash
# Base URL for tests
PLAYWRIGHT_BASE_URL=http://localhost:3000

# NextAuth configuration (if needed)
NEXTAUTH_SECRET=test-secret-for-playwright
NEXTAUTH_URL=http://localhost:3000

# OAuth providers (for OAuth tests)
GITHUB_CLIENT_ID=test-client-id
GITHUB_CLIENT_SECRET=test-client-secret
GOOGLE_CLIENT_ID=test-client-id
GOOGLE_CLIENT_SECRET=test-client-secret
```

### Playwright Config

The tests use the existing `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Best Practices

### 1. Use Fixtures for Authentication
```typescript
// ✅ Good - Uses fixture
test('protected route', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
});

// ❌ Bad - Manual auth in each test
test('protected route', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'test@example.com');
  // ... more setup
});
```

### 2. Clear Cookies Between Tests
```typescript
test.beforeEach(async ({ page }) => {
  // Clear any existing session
  await page.context().clearCookies();
});
```

### 3. Wait for Navigation
```typescript
// ✅ Good - Wait for URL
await page.getByRole('button', { name: /sign in/i }).click();
await page.waitForURL(/\/dashboard/);

// ❌ Bad - No wait
await page.getByRole('button', { name: /sign in/i }).click();
// Assertion might run before navigation
```

### 4. Use Role Selectors
```typescript
// ✅ Good - Semantic selectors
await page.getByRole('button', { name: /sign in/i }).click();
await page.getByPlaceholder(/email/i).fill('test@example.com');

// ❌ Bad - CSS selectors
await page.click('#login-button');
await page.fill('.email-input', 'test@example.com');
```

## Troubleshooting

### Tests fail with "No such file or directory"
Make sure the dev server is running:
```bash
npm run dev
```

### Tests timeout
Increase timeout in test or globally:
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ... test code
});
```

### OAuth tests fail in CI
OAuth tests may need to be skipped or mocked in CI:
```typescript
test.skip(process.env.CI, 'OAuth test - requires real credentials');
```

### Session not persisting
Check that cookies are being set correctly:
```typescript
const cookies = await page.context().cookies();
console.log('Current cookies:', cookies);
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Auth Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run auth tests
        run: npx playwright test auth.spec.ts

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Test Statistics

- **Total Test Cases**: 61
- **Test Suites**: 14
- **Code Coverage**: Authentication flows
- **Estimated Runtime**: 2-3 minutes (with parallel execution)

## Future Improvements

1. **Test Database Seeding**
   - Pre-populate test database with known users
   - Support for test data cleanup

2. **Multi-Factor Authentication**
   - Add tests for 2FA flows when implemented

3. **Social Login Integration**
   - Real OAuth flow testing with mock providers

4. **Rate Limiting Tests**
   - Test login attempt rate limits

5. **Password Policy Tests**
   - Test password expiration
   - Test password history

## Related Documentation

- [Playwright Documentation](https://playwright.dev/)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)

## Support

For issues or questions about the auth tests:
1. Check this README
2. Review existing test cases in `auth.spec.ts`
3. Check Playwright documentation
4. Contact the QA team
