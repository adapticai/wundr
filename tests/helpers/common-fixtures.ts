import { Page, BrowserContext } from '@playwright/test';

/**
 * Common Test Fixtures and Utilities
 *
 * Reusable fixtures and utility functions for all test templates.
 */

/**
 * Test user credentials for authentication tests
 */
export const TEST_USERS = {
  admin: {
    email: 'admin@test.local',
    password: 'AdminPassword123!',
  },
  user: {
    email: 'user@test.local',
    password: 'UserPassword123!',
  },
  guest: {
    email: 'guest@test.local',
    password: 'GuestPassword123!',
  },
};

/**
 * Common test data
 */
export const TEST_DATA = {
  forms: {
    validEmail: 'test@example.com',
    invalidEmail: 'not-an-email',
    validPassword: 'SecurePassword123!',
    weakPassword: '123',
    validPhoneNumber: '+1234567890',
    invalidPhoneNumber: 'not-a-number',
  },
  text: {
    longText: 'a'.repeat(1000),
    specialChars: '!@#$%^&*()',
    htmlContent: '<script>alert("xss")</script>',
    sqlInjection: "'; DROP TABLE users; --",
  },
};

/**
 * Commonly used selectors
 */
export const COMMON_SELECTORS = {
  buttons: {
    submit: 'button[type="submit"]',
    cancel: 'button[type="button"]:has-text("Cancel")',
    delete: 'button:has-text("Delete")',
    save: 'button:has-text("Save")',
  },
  inputs: {
    email: 'input[type="email"]',
    password: 'input[type="password"]',
    text: 'input[type="text"]',
    search: 'input[placeholder*="Search"]',
  },
  states: {
    loading: '[class*="loading"]',
    skeleton: '[class*="skeleton"]',
    error: '[class*="error"]',
    success: '[class*="success"]',
  },
};

/**
 * Wait utilities
 */
export async function waitForElement(page: Page, selector: string, timeout = 5000): Promise<void> {
  await page.waitForSelector(selector, { timeout });
}

export async function waitForElementToDisappear(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<void> {
  await page.waitForSelector(selector, { state: 'hidden', timeout });
}

export async function waitForNavigation(page: Page, timeout = 5000): Promise<void> {
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout });
}

/**
 * DOM utilities
 */
export async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 1000 });
    const visible = await page.isVisible(selector);
    return visible;
  } catch {
    return false;
  }
}

export async function isElementEnabled(page: Page, selector: string): Promise<boolean> {
  try {
    const enabled = await page.isEnabled(selector);
    return enabled;
  } catch {
    return false;
  }
}

export async function getElementText(page: Page, selector: string): Promise<string> {
  const element = page.locator(selector).first();
  return element.textContent({ timeout: 3000 }).then((text) => text || '');
}

export async function getElementValue(page: Page, selector: string): Promise<string> {
  const element = page.locator(selector).first();
  return element.inputValue({ timeout: 3000 }).then((value) => value || '');
}

/**
 * Form utilities
 */
export async function fillForm(
  page: Page,
  fields: Record<string, string | number | boolean>
): Promise<void> {
  for (const [selector, value] of Object.entries(fields)) {
    const element = page.locator(selector).first();

    if (typeof value === 'boolean') {
      if (value) {
        await element.check();
      } else {
        await element.uncheck();
      }
    } else {
      await element.fill(String(value));
    }
  }
}

export async function submitForm(page: Page, formSelector: string): Promise<void> {
  const form = page.locator(formSelector);
  const submitButton = form.locator('button[type="submit"]').first();
  await submitButton.click();
  await page.waitForLoadState('networkidle');
}

/**
 * Network utilities
 */
export async function waitForRequest(page: Page, urlPattern: string | RegExp): Promise<string> {
  return new Promise((resolve) => {
    page.on('request', (request) => {
      if (
        (typeof urlPattern === 'string' && request.url().includes(urlPattern)) ||
        (urlPattern instanceof RegExp && urlPattern.test(request.url()))
      ) {
        resolve(request.url());
      }
    });
  });
}

export async function waitForResponse(
  page: Page,
  urlPattern: string | RegExp
): Promise<Response> {
  return page.waitForResponse((response) => {
    if (typeof urlPattern === 'string') {
      return response.url().includes(urlPattern);
    }
    return urlPattern.test(response.url());
  });
}

export async function mockAPI(
  page: Page,
  urlPattern: string | RegExp,
  responseData: Record<string, any>,
  status = 200
): Promise<void> {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(responseData),
    });
  });
}

/**
 * Local storage utilities
 */
export async function setLocalStorage(
  page: Page,
  key: string,
  value: string | Record<string, any>
): Promise<void> {
  await page.evaluate(
    ({ key: k, value: v }) => {
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    },
    { key, value }
  );
}

export async function getLocalStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear());
}

/**
 * Cookie utilities
 */
export async function setCookie(
  page: Page,
  name: string,
  value: string,
  options?: { domain?: string; path?: string; expires?: number }
): Promise<void> {
  const context = page.context();
  await context.addCookies([
    {
      name,
      value,
      domain: options?.domain || 'localhost',
      path: options?.path || '/',
      expires: options?.expires,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

export async function getCookie(page: Page, name: string): Promise<string | null> {
  const cookies = await page.context().cookies();
  const cookie = cookies.find((c) => c.name === name);
  return cookie?.value || null;
}

export async function clearCookies(page: Page): Promise<void> {
  await page.context().clearCookies();
}

/**
 * Accessibility utilities
 */
export async function checkPageAccessibility(page: Page): Promise<string[]> {
  const issues: string[] = [];

  const accessibilityIssues = await page.evaluate(() => {
    const a11yIssues: string[] = [];

    // Check for images without alt text
    document.querySelectorAll('img').forEach((img) => {
      if (!img.alt && !img.getAttribute('aria-label')) {
        a11yIssues.push(`Image missing alt text: ${img.src}`);
      }
    });

    // Check for headings
    if (!document.querySelector('h1')) {
      a11yIssues.push('No h1 heading found on page');
    }

    // Check for form labels
    document.querySelectorAll('input').forEach((input) => {
      if (
        input.type !== 'hidden' &&
        !document.querySelector(`label[for="${input.id}"]`) &&
        !input.getAttribute('aria-label')
      ) {
        a11yIssues.push(`Input missing label: ${input.name || input.id}`);
      }
    });

    return a11yIssues;
  });

  return [...issues, ...accessibilityIssues];
}

/**
 * Screenshot utilities
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options?: { fullPage?: boolean }
): Promise<Buffer> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshots/${name}-${timestamp}.png`;
  return page.screenshot({
    path: filename,
    fullPage: options?.fullPage ?? true,
  });
}

export async function compareScreenshots(
  page: Page,
  baselineName: string,
  currentName: string
): Promise<boolean> {
  // This is a placeholder - actual comparison would need
  // a screenshot comparison library like pixelmatch
  return false;
}

/**
 * Performance utilities
 */
export async function measurePageLoadTime(page: Page): Promise<number> {
  await page.waitForLoadState('networkidle');
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return navigation.loadEventEnd - navigation.navigationStart;
  });
}

export async function getWebVitals(page: Page): Promise<{ CLS: number; LCP: number; FID: number }> {
  return page.evaluate(() => {
    const metrics = {
      CLS: 0,
      LCP: 0,
      FID: 0,
    };

    // Get CLS
    const layoutShifts = performance.getEntries().filter((e) => e.entryType === 'layout-shift');
    metrics.CLS = layoutShifts.reduce((sum, e) => sum + (e as any).value, 0);

    // Get LCP
    const largestContentfulPaint = performance
      .getEntries()
      .filter((e) => e.entryType === 'largest-contentful-paint')
      .pop() as any;
    metrics.LCP = largestContentfulPaint?.renderTime || largestContentfulPaint?.loadTime || 0;

    // Get FID - first input delay (not easily measurable without user interaction)
    metrics.FID = 0;

    return metrics;
  });
}

/**
 * Event utilities
 */
export async function triggerEvent(
  page: Page,
  selector: string,
  event: string
): Promise<void> {
  await page.locator(selector).first().dispatchEvent(event);
}

export async function hoverElement(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().hover();
}

export async function focusElement(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().focus();
}

/**
 * Context utilities
 */
export async function getCacheStorage(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      caches.keys().then((names) => {
        resolve(names);
      });
    });
  });
}

export async function getSessionStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const storage: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        storage[key] = sessionStorage.getItem(key) || '';
      }
    }
    return storage;
  });
}
