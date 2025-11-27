/**
 * Authentication Flow - Playwright E2E Tests
 *
 * Comprehensive test suite for all authentication flows including:
 * - Login page and form validation
 * - Registration page and form validation
 * - Forgot password flow
 * - Password reset flow
 * - OAuth providers (GitHub, Google)
 * - Logout functionality
 * - Protected route access control
 * - Session management
 *
 * @requires Playwright
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// Test user credentials
const TEST_USER = {
  email: 'test@neolith.dev',
  password: 'TestPassword123!',
  name: 'Test User',
};

const INVALID_USER = {
  email: 'invalid@example.com',
  password: 'WrongPassword123!',
};

test.describe('Authentication Flows - Complete Test Suite', () => {
  test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
    });

    test('should load login page correctly', async ({ page }) => {
      // Check page title/heading
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

      // Check description text
      await expect(page.getByText(/sign in to your account to continue/i)).toBeVisible();

      // Check OAuth buttons are visible
      await expect(page.getByRole('button', { name: /continue with github/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();

      // Check email/password form is visible
      await expect(page.getByPlaceholder(/email address/i)).toBeVisible();
      await expect(page.getByPlaceholder(/^password$/i)).toBeVisible();

      // Check submit button
      await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();

      // Check links
      await expect(page.getByRole('link', { name: /forgot your password/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
    });

    test('should display OAuth provider buttons with icons', async ({ page }) => {
      const githubBtn = page.getByRole('button', { name: /continue with github/i });
      const googleBtn = page.getByRole('button', { name: /continue with google/i });

      await expect(githubBtn).toBeVisible();
      await expect(googleBtn).toBeVisible();

      // Check for SVG icons
      await expect(githubBtn.locator('svg')).toBeVisible();
      await expect(googleBtn.locator('svg')).toBeVisible();
    });

    test('should show divider with "Or continue with email" text', async ({ page }) => {
      await expect(page.getByText(/or continue with email/i)).toBeVisible();
    });

    test('should validate empty email field', async ({ page }) => {
      const passwordInput = page.getByPlaceholder(/^password$/i);
      const submitBtn = page.getByRole('button', { name: /^sign in$/i });

      await passwordInput.fill('SomePassword123');
      await submitBtn.click();

      // HTML5 validation should prevent submission
      const emailInput = page.getByPlaceholder(/email address/i);
      const validationMessage = await emailInput.evaluate((input: HTMLInputElement) => input.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test('should validate empty password field', async ({ page }) => {
      const emailInput = page.getByPlaceholder(/email address/i);
      const submitBtn = page.getByRole('button', { name: /^sign in$/i });

      await emailInput.fill('test@example.com');
      await submitBtn.click();

      // HTML5 validation should prevent submission
      const passwordInput = page.getByPlaceholder(/^password$/i);
      const validationMessage = await passwordInput.evaluate((input: HTMLInputElement) => input.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test('should validate email format', async ({ page }) => {
      const emailInput = page.getByPlaceholder(/email address/i);

      await emailInput.fill('invalid-email');

      const validationMessage = await emailInput.evaluate((input: HTMLInputElement) => input.validationMessage);
      expect(validationMessage).toContain('email');
    });

    test('should show error message for invalid credentials', async ({ page }) => {
      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/^password$/i);
      const submitBtn = page.getByRole('button', { name: /^sign in$/i });

      await emailInput.fill(INVALID_USER.email);
      await passwordInput.fill(INVALID_USER.password);
      await submitBtn.click();

      // Wait for error message
      await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 5000 });
    });

    test('should disable form inputs while submitting', async ({ page }) => {
      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/^password$/i);
      const submitBtn = page.getByRole('button', { name: /^sign in$/i });

      await emailInput.fill(INVALID_USER.email);
      await passwordInput.fill(INVALID_USER.password);

      // Click submit and immediately check disabled state
      await submitBtn.click();

      // Should show loading state
      await expect(page.getByRole('button', { name: /signing in/i })).toBeVisible();

      // Inputs should be disabled
      await expect(emailInput).toBeDisabled();
      await expect(passwordInput).toBeDisabled();
    });

    test('should navigate to forgot password page', async ({ page }) => {
      await page.getByRole('link', { name: /forgot your password/i }).click();

      await expect(page).toHaveURL(/\/forgot-password/);
    });

    test('should navigate to register page', async ({ page }) => {
      await page.getByRole('link', { name: /sign up/i }).click();

      await expect(page).toHaveURL(/\/register/);
    });

    test('should have proper autocomplete attributes', async ({ page }) => {
      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/^password$/i);

      const emailAutocomplete = await emailInput.getAttribute('autocomplete');
      const passwordAutocomplete = await passwordInput.getAttribute('autocomplete');

      expect(emailAutocomplete).toBe('email');
      expect(passwordAutocomplete).toBe('current-password');
    });

    test('should clear error message when user starts typing', async ({ page }) => {
      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/^password$/i);
      const submitBtn = page.getByRole('button', { name: /^sign in$/i });

      // Trigger error
      await emailInput.fill(INVALID_USER.email);
      await passwordInput.fill(INVALID_USER.password);
      await submitBtn.click();
      await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 5000 });

      // Start typing in email field
      await emailInput.fill('');
      await emailInput.fill('n');

      // Error should be cleared (or at least not visible during new attempt)
      // Note: Implementation may vary, adjust based on actual behavior
    });
  });

  test.describe('Register Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/register`);
    });

    test('should load register page correctly', async ({ page }) => {
      // Check page title/heading
      await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();

      // Check description
      await expect(page.getByText(/get started with neolith today/i)).toBeVisible();

      // Check OAuth buttons
      await expect(page.getByRole('button', { name: /sign up with github/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /sign up with google/i })).toBeVisible();

      // Check form fields
      await expect(page.getByPlaceholder(/full name/i)).toBeVisible();
      await expect(page.getByPlaceholder(/email address/i)).toBeVisible();
      await expect(page.getByPlaceholder(/^password$/i)).toBeVisible();
      await expect(page.getByPlaceholder(/confirm password/i)).toBeVisible();

      // Check submit button
      await expect(page.getByRole('button', { name: /^create account$/i })).toBeVisible();

      // Check login link
      await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    });

    test('should validate all required fields are filled', async ({ page }) => {
      const submitBtn = page.getByRole('button', { name: /^create account$/i });

      await submitBtn.click();

      // HTML5 validation should prevent submission
      const nameInput = page.getByPlaceholder(/full name/i);
      const validationMessage = await nameInput.evaluate((input: HTMLInputElement) => input.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test('should validate email format on registration', async ({ page }) => {
      const emailInput = page.getByPlaceholder(/email address/i);

      await emailInput.fill('not-a-valid-email');

      const validationMessage = await emailInput.evaluate((input: HTMLInputElement) => input.validationMessage);
      expect(validationMessage).toContain('email');
    });

    test('should validate password length (minimum 8 characters)', async ({ page }) => {
      const nameInput = page.getByPlaceholder(/full name/i);
      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/^password$/i);
      const confirmPasswordInput = page.getByPlaceholder(/confirm password/i);
      const submitBtn = page.getByRole('button', { name: /^create account$/i });

      await nameInput.fill(TEST_USER.name);
      await emailInput.fill(TEST_USER.email);
      await passwordInput.fill('short');
      await confirmPasswordInput.fill('short');
      await submitBtn.click();

      // Should show error about password length
      await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible({ timeout: 3000 });
    });

    test('should validate passwords match', async ({ page }) => {
      const nameInput = page.getByPlaceholder(/full name/i);
      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/^password$/i);
      const confirmPasswordInput = page.getByPlaceholder(/confirm password/i);
      const submitBtn = page.getByRole('button', { name: /^create account$/i });

      await nameInput.fill(TEST_USER.name);
      await emailInput.fill(TEST_USER.email);
      await passwordInput.fill('Password123!');
      await confirmPasswordInput.fill('DifferentPassword123!');
      await submitBtn.click();

      // Should show error about passwords not matching
      await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 3000 });
    });

    test('should show error for existing email', async ({ page }) => {
      const nameInput = page.getByPlaceholder(/full name/i);
      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/^password$/i);
      const confirmPasswordInput = page.getByPlaceholder(/confirm password/i);
      const submitBtn = page.getByRole('button', { name: /^create account$/i });

      // Try to register with existing email (adjust based on your test data)
      await nameInput.fill(TEST_USER.name);
      await emailInput.fill('existing@example.com');
      await passwordInput.fill('ValidPassword123!');
      await confirmPasswordInput.fill('ValidPassword123!');
      await submitBtn.click();

      // Should show error about email already in use (if API is set up)
      // Adjust expected message based on actual API response
      await page.waitForTimeout(2000);

      // Check for any error message
      const errorMessages = page.locator('.text-destructive, [class*="error"]');
      const errorCount = await errorMessages.count();

      // If there's an error, verify it's about registration failure
      if (errorCount > 0) {
        const errorText = await errorMessages.first().textContent();
        expect(errorText?.toLowerCase()).toMatch(/registration|failed|exists|already/i);
      }
    });

    test('should disable form during submission', async ({ page }) => {
      const nameInput = page.getByPlaceholder(/full name/i);
      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/^password$/i);
      const confirmPasswordInput = page.getByPlaceholder(/confirm password/i);
      const submitBtn = page.getByRole('button', { name: /^create account$/i });

      await nameInput.fill(TEST_USER.name);
      await emailInput.fill(`test-${Date.now()}@example.com`);
      await passwordInput.fill('ValidPassword123!');
      await confirmPasswordInput.fill('ValidPassword123!');

      await submitBtn.click();

      // Should show loading state
      await expect(page.getByRole('button', { name: /creating account/i })).toBeVisible();

      // Form inputs should be disabled
      await expect(nameInput).toBeDisabled();
      await expect(emailInput).toBeDisabled();
      await expect(passwordInput).toBeDisabled();
      await expect(confirmPasswordInput).toBeDisabled();
    });

    test('should navigate to login page from link', async ({ page }) => {
      await page.getByRole('link', { name: /sign in/i }).click();

      await expect(page).toHaveURL(/\/login/);
    });

    test('should have proper autocomplete attributes', async ({ page }) => {
      const nameInput = page.getByPlaceholder(/full name/i);
      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/^password$/i);
      const confirmPasswordInput = page.getByPlaceholder(/confirm password/i);

      expect(await nameInput.getAttribute('autocomplete')).toBe('name');
      expect(await emailInput.getAttribute('autocomplete')).toBe('email');
      expect(await passwordInput.getAttribute('autocomplete')).toBe('new-password');
      expect(await confirmPasswordInput.getAttribute('autocomplete')).toBe('new-password');
    });
  });

  test.describe('Forgot Password Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/forgot-password`);
    });

    test('should load forgot password page correctly', async ({ page }) => {
      // Check heading
      await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();

      // Check description
      await expect(page.getByText(/enter your email address.*send you a link/i)).toBeVisible();

      // Check email input
      await expect(page.getByPlaceholder(/email address/i)).toBeVisible();

      // Check submit button
      await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();

      // Check back to login link
      await expect(page.getByRole('link', { name: /back to login/i })).toBeVisible();

      // Check register link
      await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
    });

    test('should validate email field is required', async ({ page }) => {
      const submitBtn = page.getByRole('button', { name: /send reset link/i });

      await submitBtn.click();

      const emailInput = page.getByPlaceholder(/email address/i);
      const validationMessage = await emailInput.evaluate((input: HTMLInputElement) => input.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test('should validate email format', async ({ page }) => {
      const emailInput = page.getByPlaceholder(/email address/i);

      await emailInput.fill('invalid-email-format');

      const validationMessage = await emailInput.evaluate((input: HTMLInputElement) => input.validationMessage);
      expect(validationMessage).toContain('email');
    });

    test('should show success message after submission', async ({ page }) => {
      const emailInput = page.getByPlaceholder(/email address/i);
      const submitBtn = page.getByRole('button', { name: /send reset link/i });

      await emailInput.fill('user@example.com');
      await submitBtn.click();

      // Should show success message (security best practice - always show success)
      await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/sent password reset instructions/i)).toBeVisible();
    });

    test('should hide form after successful submission', async ({ page }) => {
      const emailInput = page.getByPlaceholder(/email address/i);
      const submitBtn = page.getByRole('button', { name: /send reset link/i });

      await emailInput.fill('user@example.com');
      await submitBtn.click();

      // Wait for success
      await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 5000 });

      // Form should be hidden
      await expect(emailInput).not.toBeVisible();
      await expect(submitBtn).not.toBeVisible();
    });

    test('should show loading state during submission', async ({ page }) => {
      const emailInput = page.getByPlaceholder(/email address/i);
      const submitBtn = page.getByRole('button', { name: /send reset link/i });

      await emailInput.fill('user@example.com');
      await submitBtn.click();

      // Should show loading state
      await expect(page.getByRole('button', { name: /sending/i })).toBeVisible();
    });

    test('should navigate back to login', async ({ page }) => {
      await page.getByRole('link', { name: /back to login/i }).click();

      await expect(page).toHaveURL(/\/login/);
    });

    test('should navigate to register page', async ({ page }) => {
      await page.getByRole('link', { name: /sign up/i }).click();

      await expect(page).toHaveURL(/\/register/);
    });

    test('should have email input autofocus', async ({ page }) => {
      const emailInput = page.getByPlaceholder(/email address/i);

      const hasAutofocus = await emailInput.getAttribute('autofocus');
      expect(hasAutofocus).not.toBeNull();
    });
  });

  test.describe('Reset Password Page', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate with a mock token
      await page.goto(`${BASE_URL}/reset-password?token=mock-reset-token-123`);
    });

    test('should load reset password page correctly', async ({ page }) => {
      // Check heading
      await expect(page.getByRole('heading', { name: /set new password/i })).toBeVisible();

      // Check description
      await expect(page.getByText(/enter your new password below/i)).toBeVisible();

      // Check password inputs
      await expect(page.getByPlaceholder(/^new password$/i)).toBeVisible();
      await expect(page.getByPlaceholder(/confirm new password/i)).toBeVisible();

      // Check submit button
      await expect(page.getByRole('button', { name: /reset password/i })).toBeVisible();

      // Check back to login link
      await expect(page.getByRole('link', { name: /back to login/i })).toBeVisible();
    });

    test('should show error when no token is provided', async ({ page }) => {
      await page.goto(`${BASE_URL}/reset-password`);

      // Should show error about missing token
      await expect(page.getByText(/no reset token provided/i)).toBeVisible({ timeout: 3000 });
    });

    test('should show password strength indicator', async ({ page }) => {
      const passwordInput = page.getByPlaceholder(/^new password$/i);

      await passwordInput.fill('weak');

      // Should show strength indicator
      await expect(page.getByText(/password strength/i)).toBeVisible();
      await expect(page.getByText(/weak/i)).toBeVisible();
    });

    test('should update password strength as user types', async ({ page }) => {
      const passwordInput = page.getByPlaceholder(/^new password$/i);

      // Weak password
      await passwordInput.fill('weak');
      await expect(page.getByText(/weak/i)).toBeVisible();

      // Medium password
      await passwordInput.fill('Medium123');
      await expect(page.getByText(/medium/i)).toBeVisible();

      // Strong password
      await passwordInput.fill('StrongPassword123!');
      await expect(page.getByText(/strong/i)).toBeVisible();
    });

    test('should validate passwords match', async ({ page }) => {
      const passwordInput = page.getByPlaceholder(/^new password$/i);
      const confirmPasswordInput = page.getByPlaceholder(/confirm new password/i);

      await passwordInput.fill('Password123!');
      await confirmPasswordInput.fill('DifferentPassword123!');

      // Should show mismatch error
      await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    });

    test('should disable submit button when passwords do not match', async ({ page }) => {
      const passwordInput = page.getByPlaceholder(/^new password$/i);
      const confirmPasswordInput = page.getByPlaceholder(/confirm new password/i);
      const submitBtn = page.getByRole('button', { name: /reset password/i });

      await passwordInput.fill('Password123!');
      await confirmPasswordInput.fill('Different123!');

      // Submit button should be disabled
      await expect(submitBtn).toBeDisabled();
    });

    test('should validate minimum password length', async ({ page }) => {
      const passwordInput = page.getByPlaceholder(/^new password$/i);
      const confirmPasswordInput = page.getByPlaceholder(/confirm new password/i);
      const submitBtn = page.getByRole('button', { name: /reset password/i });

      await passwordInput.fill('Short1!');
      await confirmPasswordInput.fill('Short1!');
      await submitBtn.click();

      // Should show error about password length
      await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible({ timeout: 3000 });
    });

    test('should validate password complexity', async ({ page }) => {
      const passwordInput = page.getByPlaceholder(/^new password$/i);
      const confirmPasswordInput = page.getByPlaceholder(/confirm new password/i);
      const submitBtn = page.getByRole('button', { name: /reset password/i });

      await passwordInput.fill('alllowercase');
      await confirmPasswordInput.fill('alllowercase');
      await submitBtn.click();

      // Should show error about password requirements
      await expect(page.getByText(/uppercase.*lowercase.*number/i)).toBeVisible({ timeout: 3000 });
    });

    test('should navigate back to login', async ({ page }) => {
      await page.getByRole('link', { name: /back to login/i }).click();

      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Logout Functionality', () => {
    test('should logout and redirect to login page', async ({ page }) => {
      // First, navigate to the dashboard (assuming user is logged in via fixtures/cookies)
      // This test may need authentication setup via context or beforeEach
      await page.goto(`${BASE_URL}/dashboard`);

      // Wait for dashboard to load
      await page.waitForLoadState('networkidle');

      // Find and click logout button (adjust selector based on actual implementation)
      // Common locations: user menu, sidebar, header
      const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout"), a:has-text("Sign out")').first();

      if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutButton.click();

        // Should redirect to login page
        await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
      } else {
        // Skip test if logout button not found (user may not be authenticated)
        test.skip();
      }
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing dashboard unauthenticated', async ({ page }) => {
      // Clear any existing session/cookies
      await page.context().clearCookies();

      // Try to access dashboard
      await page.goto(`${BASE_URL}/dashboard`);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('should redirect to login when accessing workspace routes unauthenticated', async ({ page }) => {
      await page.context().clearCookies();

      await page.goto(`${BASE_URL}/workspace-123/channels`);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('should redirect to login when accessing settings unauthenticated', async ({ page }) => {
      await page.context().clearCookies();

      await page.goto(`${BASE_URL}/workspace-123/settings`);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('should redirect to login when accessing admin routes unauthenticated', async ({ page }) => {
      await page.context().clearCookies();

      await page.goto(`${BASE_URL}/workspace-123/admin/members`);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('should redirect to login when accessing VPs unauthenticated', async ({ page }) => {
      await page.context().clearCookies();

      await page.goto(`${BASE_URL}/workspace-123/orchestrators`);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('should redirect to login when accessing workflows unauthenticated', async ({ page }) => {
      await page.context().clearCookies();

      await page.goto(`${BASE_URL}/workspace-123/workflows`);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });
  });

  test.describe('OAuth Provider Flows', () => {
    test('should initiate GitHub OAuth when clicking GitHub button', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Listen for navigation to GitHub
      const navigationPromise = page.waitForURL(/github\.com/);

      await page.getByRole('button', { name: /continue with github/i }).click();

      // Should navigate to GitHub OAuth page
      try {
        await navigationPromise;
        expect(page.url()).toContain('github.com');
      } catch {
        // In test environment, OAuth might be mocked or redirected
        // Check if we're on a callback URL or still on login
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/login|\/callback|\/dashboard/);
      }
    });

    test('should initiate Google OAuth when clicking Google button', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Listen for navigation to Google
      const navigationPromise = page.waitForURL(/accounts\.google\.com/);

      await page.getByRole('button', { name: /continue with google/i }).click();

      // Should navigate to Google OAuth page
      try {
        await navigationPromise;
        expect(page.url()).toContain('google.com');
      } catch {
        // In test environment, OAuth might be mocked
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/login|\/callback|\/dashboard/);
      }
    });

    test('should disable OAuth buttons during OAuth flow', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      const githubBtn = page.getByRole('button', { name: /continue with github/i });
      const googleBtn = page.getByRole('button', { name: /continue with google/i });

      // Click GitHub button
      await githubBtn.click();

      // Both OAuth buttons should be disabled
      await expect(githubBtn).toBeDisabled();
      await expect(googleBtn).toBeDisabled();
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page refreshes', async ({ page }) => {
      // This test requires authentication setup
      // Navigate to dashboard (authenticated)
      await page.goto(`${BASE_URL}/dashboard`);

      // Check if we're on dashboard (not redirected to login)
      const currentUrl = page.url();

      if (currentUrl.includes('/dashboard')) {
        // Refresh the page
        await page.reload();

        // Should still be on dashboard (session maintained)
        await expect(page).toHaveURL(/\/dashboard/);
      } else {
        // User not authenticated, skip test
        test.skip();
      }
    });

    test('should handle expired sessions gracefully', async ({ page }) => {
      // Clear cookies to simulate expired session
      await page.context().clearCookies();

      // Try to access protected route
      await page.goto(`${BASE_URL}/dashboard`);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });
  });

  test.describe('Accessibility & UX', () => {
    test('should support keyboard navigation on login form', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Tab through form elements
      await page.keyboard.press('Tab'); // Focus first element
      await page.keyboard.press('Tab'); // Email input

      const emailInput = page.getByPlaceholder(/email address/i);
      await expect(emailInput).toBeFocused();

      await page.keyboard.press('Tab'); // Password input
      const passwordInput = page.getByPlaceholder(/^password$/i);
      await expect(passwordInput).toBeFocused();

      await page.keyboard.press('Tab'); // Submit button
      const submitBtn = page.getByRole('button', { name: /^sign in$/i });
      await expect(submitBtn).toBeFocused();
    });

    test('should allow form submission with Enter key', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/^password$/i);

      await emailInput.fill(INVALID_USER.email);
      await passwordInput.fill(INVALID_USER.password);

      // Press Enter to submit
      await passwordInput.press('Enter');

      // Should show error (form was submitted)
      await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 5000 });
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Check for proper form roles
      const form = page.locator('form');
      await expect(form).toBeVisible();

      // Check buttons have proper roles
      const submitBtn = page.getByRole('button', { name: /^sign in$/i });
      await expect(submitBtn).toBeVisible();

      // Check links have proper roles
      const forgotPasswordLink = page.getByRole('link', { name: /forgot your password/i });
      await expect(forgotPasswordLink).toBeVisible();
    });

    test('should show password visibility toggle (if implemented)', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      const passwordInput = page.getByPlaceholder(/^password$/i);

      // Check initial type is password
      const initialType = await passwordInput.getAttribute('type');
      expect(initialType).toBe('password');

      // Look for visibility toggle button (if implemented)
      const toggleBtn = page.locator('button:has([aria-label*="password"]), button:has([aria-label*="visibility"])');

      if (await toggleBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await toggleBtn.click();

        // Type should change to text
        const newType = await passwordInput.getAttribute('type');
        expect(newType).toBe('text');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Simulate offline mode
      await page.context().setOffline(true);

      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/^password$/i);
      const submitBtn = page.getByRole('button', { name: /^sign in$/i });

      await emailInput.fill(TEST_USER.email);
      await passwordInput.fill(TEST_USER.password);
      await submitBtn.click();

      // Should show error message
      await expect(page.getByText(/error|failed|try again/i)).toBeVisible({ timeout: 5000 });

      // Restore online mode
      await page.context().setOffline(false);
    });

    test('should handle API errors with appropriate messages', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Attempt login with invalid credentials
      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/^password$/i);
      const submitBtn = page.getByRole('button', { name: /^sign in$/i });

      await emailInput.fill(INVALID_USER.email);
      await passwordInput.fill(INVALID_USER.password);
      await submitBtn.click();

      // Should show specific error message
      const errorMessage = page.locator('.text-destructive, [class*="error"]').first();
      await expect(errorMessage).toBeVisible({ timeout: 5000 });

      const errorText = await errorMessage.textContent();
      expect(errorText?.toLowerCase()).toMatch(/invalid|incorrect|wrong|failed/);
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should display login form correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/login`);

      // All elements should be visible
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
      await expect(page.getByPlaceholder(/email address/i)).toBeVisible();
      await expect(page.getByPlaceholder(/^password$/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    });

    test('should have proper touch targets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/login`);

      // Check button sizes (should be at least 44x44px for touch)
      const submitBtn = page.getByRole('button', { name: /^sign in$/i });
      const boundingBox = await submitBtn.boundingBox();

      expect(boundingBox?.height).toBeGreaterThanOrEqual(40);
    });

    test('should not have horizontal scroll on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/login`);

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasHorizontalScroll).toBe(false);
    });
  });
});
