# Authentication Setup for Dashboard Tests

This guide explains how to set up authentication for Playwright E2E tests.

## Overview

The dashboard tests use **storage state** authentication, which means:
- Login happens once in a setup script
- Session cookies are saved to a file
- All tests reuse the saved session
- No need to login in every test

## Quick Start

### 1. Create Test User

You need a valid user account in your development database. You can:

**Option A: Create via signup flow**
```bash
# Start dev server
npm run dev

# Navigate to http://localhost:3000/signup
# Create a test account
```

**Option B: Create via database seed**
```bash
# Add test user to your seed script
npx prisma db seed

# Or use Prisma Studio
npx prisma studio
```

**Option C: Use existing account**
- Use your own development account credentials

### 2. Configure Environment Variables

Create `.env.test` file:

```bash
# Copy example file
cp .env.test.example .env.test

# Edit with your credentials
vim .env.test
```

Add your test credentials:

```bash
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

### 3. Run Authentication Setup

Generate the authentication state file:

```bash
npx playwright test auth.setup.ts --project=setup
```

This will:
1. Navigate to login page
2. Fill in credentials from `.env.test`
3. Submit login form
4. Wait for redirect to dashboard
5. Save session to `playwright/.auth/user.json`

### 4. Run Dashboard Tests

Now you can run the dashboard tests with authentication:

```bash
npx playwright test dashboard.spec.ts
```

All tests will automatically use the saved authentication state.

## File Structure

```
apps/web/
├── tests/
│   ├── auth.setup.ts              # Auth setup script
│   ├── dashboard.spec.ts          # Dashboard tests (uses auth)
│   └── AUTHENTICATION_SETUP.md    # This file
├── playwright/
│   └── .auth/
│       └── user.json              # Saved session (auto-generated)
├── .env.test                       # Test credentials (create this)
├── .env.test.example               # Example template
└── playwright.config.ts            # Playwright config
```

## How It Works

### 1. Setup Script (`auth.setup.ts`)

```typescript
import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to login
  await page.goto('http://localhost:3000/login');

  // Get credentials from env
  const email = process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'testpassword123';

  // Fill and submit login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for successful login
  await page.waitForURL(/\/.*\/dashboard/, { timeout: 15000 });

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
```

### 2. Test File (`dashboard.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';
import * as path from 'path';

// Use saved authentication state
test.use({
  storageState: path.join(__dirname, '../playwright/.auth/user.json')
});

test.describe('Dashboard', () => {
  test('displays user data', async ({ page }) => {
    // Already authenticated - just navigate
    await page.goto('/');

    // Verify authenticated content
    await expect(page.locator('h1:has-text("Welcome")')).toBeVisible();
  });
});
```

### 3. Playwright Config

```typescript
export default defineConfig({
  projects: [
    // Setup runs first
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Tests depend on setup
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
```

## Authentication Storage

### What Gets Saved?

The `user.json` file contains:
- Session cookies (NextAuth session token)
- Local storage data
- Session storage data
- Browser state

Example `user.json`:
```json
{
  "cookies": [
    {
      "name": "next-auth.session-token",
      "value": "eyJhbGciOiJIUzI1NiJ9...",
      "domain": "localhost",
      "path": "/",
      "expires": 1234567890,
      "httpOnly": true,
      "secure": false,
      "sameSite": "Lax"
    }
  ],
  "origins": []
}
```

### Security Notes

- **Never commit** `user.json` to git (already in `.gitignore`)
- **Never commit** `.env.test` with real credentials
- Use test-only accounts, not production accounts
- Regenerate auth state regularly (sessions expire)

## Troubleshooting

### Setup Fails: Cannot Find Login Page

**Problem**: `auth.setup.ts` fails with "Navigation timeout"

**Solution**:
1. Verify dev server is running: `npm run dev`
2. Check login URL: http://localhost:3000/login
3. Verify `PLAYWRIGHT_BASE_URL` in `.env.test`

```bash
# Check if server is running
curl http://localhost:3000/login

# Run setup in debug mode
npx playwright test auth.setup.ts --project=setup --debug
```

### Setup Fails: Invalid Credentials

**Problem**: Login fails with "Invalid credentials"

**Solution**:
1. Verify credentials in `.env.test` are correct
2. Check user exists in database
3. Verify password is correct (check if hashed correctly)

```bash
# Check user in database
npx prisma studio
# Navigate to User table, verify email exists
```

### Tests Fail: Redirected to Login

**Problem**: Tests redirect to login instead of showing dashboard

**Solutions**:

**A. Session Expired**
```bash
# Regenerate auth state
npx playwright test auth.setup.ts --project=setup
```

**B. Auth File Not Found**
```bash
# Check file exists
ls -la playwright/.auth/user.json

# If missing, run setup
npx playwright test auth.setup.ts --project=setup
```

**C. Wrong Storage State Path**
```typescript
// Verify path in dashboard.spec.ts
test.use({
  storageState: path.join(__dirname, '../playwright/.auth/user.json')
  // Should resolve to: apps/web/playwright/.auth/user.json
});
```

### CI/CD: Authentication Setup Fails

**Problem**: Setup works locally but fails in CI

**Solutions**:

**A. Missing Environment Variables**
```yaml
# GitHub Actions example
- name: Run tests
  run: npx playwright test
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

**B. Database Not Seeded**
```yaml
# Seed database before tests
- name: Setup database
  run: |
    npx prisma db push
    npx prisma db seed
```

**C. Server Not Ready**
```yaml
# Wait for server to be ready
- name: Wait for server
  run: npx wait-on http://localhost:3000
```

## Multiple Test Users

If you need different user roles:

### Create Multiple Auth Files

```typescript
// auth.setup.admin.ts
const authFile = path.join(__dirname, '../playwright/.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
  await page.fill('input[type="email"]', process.env.ADMIN_EMAIL);
  await page.fill('input[type="password"]', process.env.ADMIN_PASSWORD);
  // ... login and save
});

// auth.setup.viewer.ts
const authFile = path.join(__dirname, '../playwright/.auth/viewer.json');

setup('authenticate as viewer', async ({ page }) => {
  await page.fill('input[type="email"]', process.env.VIEWER_EMAIL);
  await page.fill('input[type="password"]', process.env.VIEWER_PASSWORD);
  // ... login and save
});
```

### Use in Tests

```typescript
// admin.spec.ts
test.use({ storageState: 'playwright/.auth/admin.json' });

test('admin can access admin panel', async ({ page }) => {
  // Test with admin privileges
});

// viewer.spec.ts
test.use({ storageState: 'playwright/.auth/viewer.json' });

test('viewer has read-only access', async ({ page }) => {
  // Test with viewer privileges
});
```

## Session Expiration

### Handle Expired Sessions

**Option 1: Regenerate Before Each Test Run**
```bash
# In package.json
{
  "scripts": {
    "test:e2e": "playwright test auth.setup.ts --project=setup && playwright test"
  }
}
```

**Option 2: Set Longer Session Duration**
```typescript
// lib/auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
```

**Option 3: Check and Refresh in Tests**
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/');

  // If redirected to login, session expired
  if (page.url().includes('/login')) {
    // Regenerate auth
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  }
});
```

## Best Practices

1. **Keep Auth Separate**: Don't mix auth logic with test logic
2. **Use Setup Project**: Run auth setup as a dependency
3. **Secure Credentials**: Use environment variables, never hardcode
4. **Regenerate Regularly**: Session expires, regenerate auth state
5. **Test Auth Separately**: Have tests for login/logout flows
6. **Handle Failures**: Add proper error handling in setup
7. **Document Requirements**: Note required user roles/permissions

## Advanced: Custom Auth Strategies

### API Token Authentication

If using API tokens instead of session cookies:

```typescript
// auth.setup.ts
setup('get API token', async ({ request }) => {
  const response = await request.post('http://localhost:3000/api/auth/login', {
    data: {
      email: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD,
    },
  });

  const { token } = await response.json();

  // Save token to file
  await fs.promises.writeFile(
    'playwright/.auth/token.txt',
    token
  );
});

// dashboard.spec.ts
test.beforeEach(async ({ page }) => {
  const token = await fs.promises.readFile(
    'playwright/.auth/token.txt',
    'utf-8'
  );

  // Set Authorization header
  await page.setExtraHTTPHeaders({
    'Authorization': `Bearer ${token}`,
  });
});
```

### OAuth Authentication

For OAuth providers (GitHub, Google):

```typescript
setup('authenticate with OAuth', async ({ page }) => {
  // Navigate to OAuth login
  await page.goto('http://localhost:3000/api/auth/signin/github');

  // Fill OAuth provider's login form
  await page.fill('input[name="login"]', process.env.GITHUB_EMAIL);
  await page.fill('input[name="password"]', process.env.GITHUB_PASSWORD);
  await page.click('button[type="submit"]');

  // Authorize app
  await page.click('button:has-text("Authorize")');

  // Wait for callback
  await page.waitForURL(/\/.*\/dashboard/);

  // Save state
  await page.context().storageState({ path: authFile });
});
```

## Summary

- **Setup once**: `npx playwright test auth.setup.ts --project=setup`
- **Run tests**: `npx playwright test dashboard.spec.ts`
- **Regenerate**: If tests fail with login redirect
- **Secure**: Never commit credentials or auth state
- **Debug**: Use `--debug` flag to troubleshoot auth issues

For more information, see:
- [Playwright Authentication Guide](https://playwright.dev/docs/auth)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Dashboard Test README](./README.md)
