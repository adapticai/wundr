import { test, expect } from '@playwright/test';

/**
 * Portable smoke tests that can be run against any web application
 * These tests are generic and work with most web apps
 */

test.describe('Portable Smoke Tests', () => {
  test('homepage loads without errors', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Basic structure should be present
    await expect(page.locator('body')).toBeVisible();

    // Should not have critical JavaScript errors
    const criticalErrors = jsErrors.filter(
      error =>
        error.includes('Cannot read') ||
        error.includes('undefined is not') ||
        error.includes('Uncaught')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('navigation elements are present', async ({ page }) => {
    await page.goto('/');

    // Check for common navigation patterns
    const hasNavigation =
      (await page.locator('nav, [role="navigation"], header').count()) > 0;
    expect(hasNavigation).toBeTruthy();
  });

  test('interactive elements are clickable', async ({ page }) => {
    await page.goto('/');

    // Find clickable elements
    const buttons = await page.locator('button:visible, a:visible').all();

    if (buttons.length > 0) {
      // Test first button/link
      const firstElement = buttons[0];
      await expect(firstElement).toBeEnabled();
    }
  });

  test('forms accept input', async ({ page }) => {
    await page.goto('/');

    // Look for form inputs
    const inputs = await page.locator('input:visible, textarea:visible').all();

    if (inputs.length > 0) {
      const firstInput = inputs[0];
      await firstInput.fill('test');
      const value = await firstInput.inputValue();
      expect(value).toBe('test');
    }
  });

  test('responsive layout works', async ({ page }) => {
    await page.goto('/');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Should not have horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });

    expect(hasHorizontalScroll).toBeFalsy();
  });

  test('page has proper metadata', async ({ page }) => {
    await page.goto('/');

    // Check for title
    const title = await page.title();
    expect(title).toBeTruthy();

    // Check for language attribute
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });
});
