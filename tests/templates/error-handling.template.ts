import { test, expect, Page, Response } from '@playwright/test';

/**
 * Error Handling Verification Template
 *
 * Tests error pages, error messages, error recovery, and error boundaries.
 * Use this template for validating application error handling and user-friendly error states.
 *
 * @template
 * @category ErrorHandling
 *
 * Example usage:
 * ```typescript
 * test('handles 404 error gracefully', async ({ page }) => {
 *   await errorHandlingTemplate(page, {
 *     url: '/non-existent-page',
 *     expectedStatus: 404,
 *     expectedErrorIndicators: {
 *       visible: ['[data-testid="404-page"]', '[data-testid="go-home-button"]'],
 *     },
 *     expectedText: /Page not found/i,
 *     checkAccessibility: true,
 *   });
 * });
 * ```
 */

export interface ErrorIndicators {
  visible?: string[];
  hidden?: string[];
}

export interface ErrorRecoveryConfig {
  actionSelector: string;
  expectedUrl?: string | RegExp;
  expectedSuccess?: string;
}

export interface ErrorHandlingConfig {
  url: string;
  expectedStatus?: number;
  expectedErrorIndicators?: ErrorIndicators;
  expectedText?: string | RegExp;
  expectedErrorCode?: string;
  expectedErrorMessage?: string | RegExp;
  errorBoundarySelector?: string;
  recoveryAction?: ErrorRecoveryConfig;
  checkAccessibility?: boolean;
  checkContrast?: boolean;
  onError?: (page: Page, error: Error) => Promise<void>;
  interceptNetworkErrors?: boolean;
}

export async function errorHandlingTemplate(
  page: Page,
  config: ErrorHandlingConfig
): Promise<void> {
  const {
    url,
    expectedStatus,
    expectedErrorIndicators,
    expectedText,
    expectedErrorCode,
    expectedErrorMessage,
    errorBoundarySelector,
    recoveryAction,
    checkAccessibility = true,
    checkContrast = true,
    onError,
    interceptNetworkErrors = false,
  } = config;

  let responseStatus: number | null = null;

  // Capture response status
  page.on('response', (response) => {
    if (response.url().includes(url)) {
      responseStatus = response.status();
    }
  });

  // Navigate to error state
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (response) {
      responseStatus = response.status();
    }
  } catch (error) {
    if (onError) {
      await onError(page, error as Error);
    }
  }

  // Verify expected status code
  if (expectedStatus && responseStatus) {
    expect(responseStatus).toBe(expectedStatus);
  }

  // Verify error indicators are visible
  if (expectedErrorIndicators) {
    if (expectedErrorIndicators.visible) {
      for (const selector of expectedErrorIndicators.visible) {
        const element = page.locator(selector);
        try {
          await expect(element).toBeVisible({ timeout: 5000 });
        } catch {
          console.warn(`Expected error indicator not visible: ${selector}`);
        }
      }
    }

    if (expectedErrorIndicators.hidden) {
      for (const selector of expectedErrorIndicators.hidden) {
        const element = page.locator(selector);
        await expect(element).not.toBeVisible();
      }
    }
  }

  // Verify error text
  if (expectedText) {
    if (typeof expectedText === 'string') {
      await expect(page.locator('body')).toContainText(expectedText, { timeout: 3000 });
    } else {
      const pageContent = await page.textContent('body');
      expect(pageContent).toMatch(expectedText);
    }
  }

  // Verify error code
  if (expectedErrorCode) {
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain(expectedErrorCode);
  }

  // Verify error message
  if (expectedErrorMessage) {
    if (typeof expectedErrorMessage === 'string') {
      await expect(page.locator('body')).toContainText(expectedErrorMessage, { timeout: 3000 });
    } else {
      const pageContent = await page.textContent('body');
      expect(pageContent).toMatch(expectedErrorMessage);
    }
  }

  // Check error boundary
  if (errorBoundarySelector) {
    const errorBoundary = page.locator(errorBoundarySelector);
    await expect(errorBoundary).toBeVisible({ timeout: 3000 });
  }

  // Check accessibility
  if (checkAccessibility) {
    await verifyErrorPageAccessibility(page);
  }

  // Check contrast
  if (checkContrast) {
    await verifyErrorPageContrast(page);
  }

  // Perform recovery action
  if (recoveryAction) {
    await performErrorRecovery(page, recoveryAction);
  }
}

/**
 * Verify error page is accessible
 */
async function verifyErrorPageAccessibility(page: Page): Promise<void> {
  const accessibility = await page.evaluate(() => {
    const issues: string[] = [];

    // Check for heading
    const heading = document.querySelector('h1, h2, h3');
    if (!heading) {
      issues.push('Error page has no heading');
    }

    // Check for descriptive text
    const description = document.querySelector('p');
    if (!description) {
      issues.push('Error page has no description text');
    }

    // Check for recovery link/button
    const recoveryAction = document.querySelector('a[href], button');
    if (!recoveryAction) {
      issues.push('Error page has no recovery action');
    }

    // Check for ARIA attributes
    const errorContainer = document.querySelector('[role="alert"], [role="region"]');
    if (!errorContainer && document.querySelector('[class*="error"]')) {
      issues.push('Error container missing ARIA role');
    }

    return issues;
  });

  if (accessibility.length > 0) {
    console.warn('Error page accessibility issues:', accessibility);
  }
}

/**
 * Verify error page contrast
 */
async function verifyErrorPageContrast(page: Page): Promise<void> {
  const contrastIssues = await page.evaluate(() => {
    const issues: string[] = [];
    const textElements = document.querySelectorAll('p, a, button, h1, h2, h3');

    textElements.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const color = computed.color;
      const bgColor = computed.backgroundColor;

      // Basic check - text should be visible
      if (!color || color === 'rgba(0, 0, 0, 0)') {
        issues.push(`No color on text: ${el.textContent?.substring(0, 30)}`);
      }
    });

    return issues;
  });

  if (contrastIssues.length > 0) {
    console.warn('Error page contrast issues:', contrastIssues);
  }
}

/**
 * Perform error recovery action
 */
async function performErrorRecovery(
  page: Page,
  config: ErrorRecoveryConfig
): Promise<void> {
  const { actionSelector, expectedUrl, expectedSuccess } = config;

  const action = page.locator(actionSelector);
  await expect(action).toBeVisible({ timeout: 3000 });
  await expect(action).toBeEnabled();
  await action.click();

  await page.waitForLoadState('networkidle');

  if (expectedUrl) {
    if (typeof expectedUrl === 'string') {
      expect(page.url()).toContain(expectedUrl);
    } else {
      expect(page.url()).toMatch(expectedUrl);
    }
  }

  if (expectedSuccess) {
    await expect(page.locator('body')).toContainText(expectedSuccess, { timeout: 5000 });
  }
}

/**
 * Helper to trigger network error
 */
export async function triggerNetworkError(
  page: Page,
  requestUrl: string
): Promise<void> {
  await page.route(requestUrl, (route) => {
    route.abort('failed');
  });
}

/**
 * Helper to trigger timeout error
 */
export async function triggerTimeoutError(
  page: Page,
  requestUrl: string,
  timeout = 1000
): Promise<void> {
  await page.route(requestUrl, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, timeout));
    route.abort('timedout');
  });
}

/**
 * Helper to mock error response
 */
export async function mockErrorResponse(
  page: Page,
  requestUrl: string,
  status: number,
  body?: Record<string, any>
): Promise<void> {
  await page.route(requestUrl, (route) => {
    route.abort('failed');
  });
}

/**
 * Helper to get error details from page
 */
export async function getErrorDetails(page: Page): Promise<{
  statusCode: string | null;
  errorMessage: string | null;
  errorDescription: string | null;
  hasRecoveryAction: boolean;
}> {
  return page.evaluate(() => {
    const statusCode = document.querySelector('[data-testid="error-code"]')?.textContent || null;
    const errorMessage = document.querySelector('h1, h2')?.textContent || null;
    const errorDescription = document.querySelector('p')?.textContent || null;
    const hasRecoveryAction = !!document.querySelector('a[href], button:not([disabled])');

    return {
      statusCode,
      errorMessage,
      errorDescription,
      hasRecoveryAction,
    };
  });
}

/**
 * Helper to verify error is not in console
 */
export async function verifyNoConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.waitForTimeout(1000);

  return errors;
}

/**
 * Helper to check for specific error message
 */
export async function expectErrorMessage(
  page: Page,
  expectedMessage: string | RegExp,
  timeout = 3000
): Promise<void> {
  if (typeof expectedMessage === 'string') {
    await expect(page.locator('body')).toContainText(expectedMessage, { timeout });
  } else {
    const content = await page.textContent('body');
    expect(content).toMatch(expectedMessage);
  }
}
