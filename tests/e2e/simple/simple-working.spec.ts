import { test, expect } from '@playwright/test';

test.describe('Simple Working Test', () => {
  test('should pass basic test', async () => {
    // This test always passes to verify test infrastructure works
    expect(1 + 1).toBe(2);
    expect(true).toBe(true);
    expect('hello').toBe('hello');
  });

  test('should verify Playwright is working', async ({ page }) => {
    // Test that we can create a page and do basic operations
    await page.setContent('<h1>Test Page</h1>');
    const title = await page.textContent('h1');
    expect(title).toBe('Test Page');
  });
});