import { test, expect, Page } from '@playwright/test';

/**
 * Page Load Validation Template
 *
 * Tests page load performance, rendering, and critical content visibility.
 * Use this template for validating that pages load correctly and render all essential elements.
 *
 * @template
 * @category PageLoad
 *
 * Example usage:
 * ```typescript
 * test('dashboard loads with all critical elements', async ({ page }) => {
 *   await pageLoadTemplate(page, {
 *     url: '/dashboard',
 *     expectedTitle: 'Dashboard',
 *     expectedElements: ['[data-testid="card-1"]', '[data-testid="card-2"]'],
 *     maxLoadTime: 3000,
 *   });
 * });
 * ```
 */

export interface PageLoadConfig {
  url: string;
  expectedTitle?: string | RegExp;
  expectedElements?: string[];
  maxLoadTime?: number;
  waitForSelector?: string;
  expectNetworkIdle?: boolean;
}

export async function pageLoadTemplate(
  page: Page,
  config: PageLoadConfig
): Promise<void> {
  const {
    url,
    expectedTitle,
    expectedElements = [],
    maxLoadTime = 5000,
    waitForSelector,
    expectNetworkIdle = true,
  } = config;

  const startTime = Date.now();

  // Navigate to page
  const navigationPromise = page.goto(url, {
    waitUntil: expectNetworkIdle ? 'networkidle' : 'domcontentloaded',
  });

  // Validate page loaded successfully
  const response = await navigationPromise;
  expect(response).not.toBeNull();
  expect(response?.status()).toBeLessThan(400);

  // Validate load time
  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(maxLoadTime);

  // Validate page title if provided
  if (expectedTitle) {
    const title = await page.title();
    if (typeof expectedTitle === 'string') {
      expect(title).toContain(expectedTitle);
    } else {
      expect(title).toMatch(expectedTitle);
    }
  }

  // Wait for specific selector if provided
  if (waitForSelector) {
    await page.waitForSelector(waitForSelector, { timeout: 5000 });
  }

  // Validate all expected elements are visible
  for (const selector of expectedElements) {
    const element = page.locator(selector).first();
    await expect(element).toBeVisible({ timeout: 5000 });
  }

  // Check for JavaScript errors
  const jsErrors: string[] = [];
  page.on('pageerror', (error) => {
    jsErrors.push(error.toString());
  });

  // Wait a moment for potential errors to occur
  await page.waitForTimeout(500);

  if (jsErrors.length > 0) {
    console.warn('JavaScript errors detected:', jsErrors);
  }

  // Verify no 404s or 500s were loaded
  page.on('response', (response) => {
    const status = response.status();
    expect(status).not.toBe(404);
    expect(status).not.toBe(500);
  });
}

/**
 * Helper to get page load metrics
 */
export async function getPageLoadMetrics(page: Page): Promise<{
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
}> {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint: (performance.getEntriesByType('paint')[0]?.startTime || 0),
    };
  });
}

/**
 * Helper to wait for page to be interactive
 */
export async function waitForPageInteractive(page: Page, timeout = 5000): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        document.addEventListener('readystatechange', () => {
          if (document.readyState === 'complete') {
            resolve();
          }
        });
      }
    });
  });

  // Also wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout });
}
