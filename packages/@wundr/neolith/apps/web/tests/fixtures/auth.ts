/**
 * Authentication Test Fixtures
 *
 * Provides utilities for creating authenticated test contexts in Playwright tests.
 * Supports both session-based and token-based authentication.
 *
 * Usage:
 * ```typescript
 * import { test as authenticatedTest } from './fixtures/auth';
 *
 * authenticatedTest('my test', async ({ page, authenticatedPage }) => {
 *   // page is already authenticated
 *   await authenticatedPage.goto('/dashboard');
 * });
 * ```
 */

import type { Page } from '@playwright/test';
import { test as base } from '@playwright/test';

/**
 * Test user for authenticated sessions
 */
export const TEST_USER = {
  id: 'test-user-id',
  email: 'test@neolith.dev',
  password: 'TestPassword123!',
  name: 'Test User',
  image: null,
  role: 'MEMBER' as const,
  isOrchestrator: false,
};

/**
 * Admin test user for elevated permissions
 */
export const ADMIN_USER = {
  id: 'admin-user-id',
  email: 'admin@neolith.dev',
  password: 'AdminPassword123!',
  name: 'Admin User',
  image: null,
  role: 'ADMIN' as const,
  isOrchestrator: false,
};

/**
 * Orchestrator test user for orchestrator authentication
 */
export const ORCHESTRATOR_USER = {
  id: 'orchestrator-user-id',
  email: 'orchestrator@neolith.dev',
  password: 'OrchestratorPassword123!',
  name: 'Test Orchestrator',
  image: null,
  role: 'MEMBER' as const,
  isOrchestrator: true,
  orchestratorId: 'test-orchestrator-123',
  apiKey: 'test-api-key',
};

/**
 * Creates a session cookie for NextAuth.js
 */
function createSessionToken(
  user: typeof TEST_USER | typeof ADMIN_USER | typeof ORCHESTRATOR_USER
) {
  // In production, this would be a proper JWT token
  // For testing, we create a mock session token
  const sessionData = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      isOrchestrator: user.isOrchestrator,
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  };

  // Base64 encode the session data
  return Buffer.from(JSON.stringify(sessionData)).toString('base64');
}

/**
 * Authenticate a page with a test user
 */
export async function authenticatePage(
  page: Page,
  user:
    | typeof TEST_USER
    | typeof ADMIN_USER
    | typeof ORCHESTRATOR_USER = TEST_USER
) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

  // Create session cookie
  const sessionToken = createSessionToken(user);

  // Set NextAuth.js session cookie
  await page.context().addCookies([
    {
      name: 'next-auth.session-token',
      value: sessionToken,
      domain: new URL(baseURL).hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
    },
    // Also set the __Secure-next-auth.session-token for HTTPS
    {
      name: '__Secure-next-auth.session-token',
      value: sessionToken,
      domain: new URL(baseURL).hostname,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    },
  ]);

  return page;
}

/**
 * Login via the UI (for more realistic testing)
 */
export async function loginViaUI(
  page: Page,
  credentials: { email: string; password: string } = TEST_USER
) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

  // Navigate to login page
  await page.goto(`${baseURL}/login`);

  // Fill in credentials
  await page.getByPlaceholder(/email address/i).fill(credentials.email);
  await page.getByPlaceholder(/^password$/i).fill(credentials.password);

  // Submit form
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });

  return page;
}

/**
 * Clear authentication cookies
 */
export async function logout(page: Page) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const domain = new URL(baseURL).hostname;

  await page.context().clearCookies({
    domain,
  });
}

/**
 * Extended test fixture with authentication helpers
 */
export const test = base.extend<{
  authenticatedPage: Page;
  adminPage: Page;
  orchestratorPage: Page;
  loginAsUser: (
    user?: typeof TEST_USER | typeof ADMIN_USER | typeof ORCHESTRATOR_USER
  ) => Promise<void>;
}>({
  /**
   * Page with regular user authentication
   */
  authenticatedPage: async ({ page }, use) => {
    await authenticatePage(page, TEST_USER);
    await use(page);
  },

  /**
   * Page with admin user authentication
   */
  adminPage: async ({ page }, use) => {
    await authenticatePage(page, ADMIN_USER);
    await use(page);
  },

  /**
   * Page with Orchestrator user authentication
   */
  orchestratorPage: async ({ page }, use) => {
    await authenticatePage(page, ORCHESTRATOR_USER);
    await use(page);
  },

  /**
   * Helper function to login as any user
   */
  loginAsUser: async ({ page }, use) => {
    const login = async (
      user:
        | typeof TEST_USER
        | typeof ADMIN_USER
        | typeof ORCHESTRATOR_USER = TEST_USER
    ) => {
      await authenticatePage(page, user);
    };
    await use(login);
  },
});

/**
 * Create a workspace context for testing
 */
export const MOCK_WORKSPACE = {
  id: 'test-workspace-123',
  name: 'Test Workspace',
  slug: 'test-workspace',
  description: 'Test workspace for E2E testing',
  status: 'ACTIVE',
  settings: {},
};

/**
 * Mock API responses for authentication
 */
export const mockAuthResponses = {
  /**
   * Mock successful login response
   */
  loginSuccess: {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: TEST_USER,
      session: {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    }),
  },

  /**
   * Mock login failure response
   */
  loginFailure: {
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({
      error: 'Invalid email or password',
    }),
  },

  /**
   * Mock registration success response
   */
  registerSuccess: {
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      user: TEST_USER,
      message: 'Account created successfully',
    }),
  },

  /**
   * Mock registration failure (email exists)
   */
  registerFailure: {
    status: 409,
    contentType: 'application/json',
    body: JSON.stringify({
      error: 'An account with this email already exists',
    }),
  },

  /**
   * Mock forgot password success
   */
  forgotPasswordSuccess: {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      message:
        'If an account exists with that email, we sent a password reset link',
    }),
  },

  /**
   * Mock reset password success
   */
  resetPasswordSuccess: {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      message: 'Password reset successfully',
    }),
  },

  /**
   * Mock reset password failure (invalid token)
   */
  resetPasswordFailure: {
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({
      error: 'Invalid or expired reset token',
    }),
  },
};

/**
 * Setup mock API routes for authentication testing
 */
export async function setupAuthMocks(
  page: Page,
  options: {
    loginSucceeds?: boolean;
    registerSucceeds?: boolean;
    forgotPasswordSucceeds?: boolean;
    resetPasswordSucceeds?: boolean;
  } = {}
) {
  const {
    loginSucceeds = true,
    registerSucceeds = true,
    forgotPasswordSucceeds = true,
    resetPasswordSucceeds = true,
  } = options;

  // Mock login endpoint
  await page.route('**/api/auth/callback/credentials*', async route => {
    const response = loginSucceeds
      ? mockAuthResponses.loginSuccess
      : mockAuthResponses.loginFailure;
    await route.fulfill(response);
  });

  // Mock registration endpoint
  await page.route('**/api/auth/register*', async route => {
    const response = registerSucceeds
      ? mockAuthResponses.registerSuccess
      : mockAuthResponses.registerFailure;
    await route.fulfill(response);
  });

  // Mock forgot password endpoint
  await page.route('**/api/auth/forgot-password*', async route => {
    const response = forgotPasswordSucceeds
      ? mockAuthResponses.forgotPasswordSuccess
      : mockAuthResponses.forgotPasswordSuccess;
    await route.fulfill(response);
  });

  // Mock reset password endpoint
  await page.route('**/api/auth/reset-password*', async route => {
    const response = resetPasswordSucceeds
      ? mockAuthResponses.resetPasswordSuccess
      : mockAuthResponses.resetPasswordFailure;
    await route.fulfill(response);
  });
}

export { expect } from '@playwright/test';
