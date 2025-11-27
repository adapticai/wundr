/**
 * Authentication Setup for Playwright Tests
 *
 * This file creates authenticated state that can be reused across tests.
 * Run this before tests to generate auth.json storage state.
 *
 * Usage:
 *   npx playwright test auth.setup.ts --project=setup
 */

import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('http://localhost:3000/login');

  // Fill in credentials
  // Option 1: Using environment variables
  const email = process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'testpassword123';

  // Wait for login form to be visible
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Fill login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard (indicates successful login)
  await page.waitForURL(/\/.*\/dashboard/, { timeout: 15000 });

  // Verify we're logged in by checking for user-specific content
  await expect(page.locator('h1:has-text("Welcome")')).toBeVisible({
    timeout: 10000,
  });

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
