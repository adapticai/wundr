import { Page, BrowserContext, expect } from '@playwright/test';
import { clearLocalStorage, clearCookies } from './common-fixtures';

/**
 * Test Setup and Teardown Utilities
 *
 * Setup and teardown functions for test templates.
 */

/**
 * Environment configuration
 */
export const TEST_CONFIG = {
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  headless: process.env.HEADLESS !== 'false',
  slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
  timeout: 30000,
  navigationTimeout: 30000,
  actionTimeout: 10000,
};

/**
 * Setup test page with common configurations
 */
export async function setupTestPage(
  page: Page,
  options?: {
    clearStorage?: boolean;
    setViewport?: { width: number; height: number };
    locale?: string;
    timezone?: string;
  }
): Promise<void> {
  const { clearStorage = true, setViewport = { width: 1280, height: 720 }, locale = 'en-US', timezone = 'UTC' } =
    options || {};

  // Clear storage if requested
  if (clearStorage) {
    await clearLocalStorage(page);
    await clearCookies(page);
  }

  // Set viewport
  await page.setViewportSize(setViewport);

  // Set locale
  if (locale) {
    await page.context().setExtraHTTPHeaders({
      'Accept-Language': locale,
    });
  }

  // Set timezone
  if (timezone) {
    await page.evaluate((tz) => {
      // Mock timezone - requires page to use it properly
      (globalThis as any).__TZ = tz;
    }, timezone);
  }

  // Disable animations for faster tests
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    `;
    document.head.appendChild(style);
  });
}

/**
 * Setup authentication for test
 */
export async function setupAuthentication(
  page: Page,
  token: string,
  options?: { storageKey?: string; headerName?: string }
): Promise<void> {
  const { storageKey = 'auth_token', headerName = 'Authorization' } = options || {};

  // Store token in local storage
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: storageKey, value: token }
  );

  // Set Authorization header for requests
  await page.context().setExtraHTTPHeaders({
    [headerName]: `Bearer ${token}`,
  });
}

/**
 * Setup mock API responses
 */
export async function setupMockAPIs(
  page: Page,
  mocks: Array<{
    pattern: string | RegExp;
    response: Record<string, any>;
    status?: number;
    delay?: number;
  }>
): Promise<void> {
  for (const mock of mocks) {
    await page.route(mock.pattern, async (route) => {
      if (mock.delay) {
        await new Promise((resolve) => setTimeout(resolve, mock.delay));
      }

      await route.fulfill({
        status: mock.status || 200,
        contentType: 'application/json',
        body: JSON.stringify(mock.response),
      });
    });
  }
}

/**
 * Setup error handling for test
 */
export async function setupErrorHandling(
  page: Page,
  options?: {
    captureConsoleErrors?: boolean;
    capturePageErrors?: boolean;
    captureNetworkErrors?: boolean;
  }
): Promise<{
  consoleErrors: string[];
  pageErrors: string[];
  networkErrors: Array<{ url: string; status: number }>;
}> {
  const { captureConsoleErrors = true, capturePageErrors = true, captureNetworkErrors = true } = options || {};

  const errors = {
    consoleErrors: [] as string[],
    pageErrors: [] as string[],
    networkErrors: [] as Array<{ url: string; status: number }>,
  };

  if (captureConsoleErrors) {
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        errors.consoleErrors.push(`${msg.type()}: ${msg.text()}`);
      }
    });
  }

  if (capturePageErrors) {
    page.on('pageerror', (error) => {
      errors.pageErrors.push(error.toString());
    });
  }

  if (captureNetworkErrors) {
    page.on('requestfailed', (request) => {
      errors.networkErrors.push({
        url: request.url(),
        status: 0,
      });
    });

    page.on('response', (response) => {
      if (response.status() >= 400) {
        errors.networkErrors.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });
  }

  return errors;
}

/**
 * Cleanup after test
 */
export async function cleanupTest(page: Page, context: BrowserContext): Promise<void> {
  // Clear all timers
  await page.evaluate(() => {
    // Clear all timeouts and intervals
    for (let i = 1; i <= 10000; i++) {
      clearTimeout(i);
      clearInterval(i);
    }
  });

  // Clear storage
  await clearLocalStorage(page);
  await clearCookies(page);
}

/**
 * Retry helper for flaky tests
 */
export async function retryTest<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; delayMs?: number }
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000 } = options || {};

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Retry failed');
}

/**
 * Expect element to exist and be visible
 */
export async function expectElementExists(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<void> {
  const element = page.locator(selector);
  await expect(element).toBeVisible({ timeout });
}

/**
 * Expect element to not exist or be hidden
 */
export async function expectElementNotExists(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<void> {
  const element = page.locator(selector);
  await expect(element).not.toBeVisible({ timeout });
}

/**
 * Expect navigation to url
 */
export async function expectNavigationTo(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 5000
): Promise<void> {
  if (typeof urlPattern === 'string') {
    expect(page.url()).toContain(urlPattern);
  } else {
    expect(page.url()).toMatch(urlPattern);
  }
}

/**
 * Wait for all images to load
 */
export async function waitForImagesToLoad(page: Page, timeout = 10000): Promise<void> {
  await page.evaluate(async () => {
    return Promise.all(
      Array.from(document.querySelectorAll('img')).map((img) => {
        return new Promise<void>((resolve) => {
          if ((img as any).complete) {
            resolve();
          } else {
            img.addEventListener('load', () => resolve());
            img.addEventListener('error', () => resolve());
          }
        });
      })
    );
  });
}

/**
 * Wait for all network requests to complete
 */
export async function waitForNetworkIdle(page: Page, timeout = 10000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Inject test utilities into page
 */
export async function injectTestUtils(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as any).__TEST_UTILS = {
      getElements: (selector: string) => {
        return document.querySelectorAll(selector).length;
      },
      getElementText: (selector: string) => {
        const el = document.querySelector(selector);
        return el?.textContent || null;
      },
      setInput: (selector: string, value: string) => {
        const el = document.querySelector(selector) as HTMLInputElement;
        if (el) {
          el.value = value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      },
      click: (selector: string) => {
        const el = document.querySelector(selector) as HTMLElement;
        if (el) {
          el.click();
        }
      },
    };
  });
}

/**
 * Call test utility from page
 */
export async function callPageTestUtil(
  page: Page,
  functionName: string,
  ...args: any[]
): Promise<any> {
  return page.evaluate(
    ({ name, args: a }) => {
      return (globalThis as any).__TEST_UTILS[name](...a);
    },
    { name: functionName, args }
  );
}
