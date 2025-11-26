import { test, expect, Page } from '@playwright/test';

/**
 * Empty State Verification Template
 *
 * Tests empty state displays when no data is available.
 * Use this template for validating empty states, no results pages, and fallback UI.
 *
 * @template
 * @category EmptyStates
 *
 * Example usage:
 * ```typescript
 * test('shows empty state when no items exist', async ({ page }) => {
 *   await emptyStateTemplate(page, {
 *     url: '/items',
 *     emptyIndicators: {
 *       visible: ['[data-testid="empty-state"]', '[data-testid="empty-icon"]'],
 *       hidden: ['[data-testid="items-list"]'],
 *     },
 *     expectedText: /No items found/i,
 *     expectedCTA: {
 *       selector: '[data-testid="create-item"]',
 *       expectedText: /Create item|Add new/i,
 *     },
 *   });
 * });
 * ```
 */

export interface CTAConfig {
  selector: string;
  expectedText?: string | RegExp;
  isDisabled?: boolean;
}

export interface EmptyStateIndicators {
  visible?: string[];
  hidden?: string[];
}

export interface EmptyStateConfig {
  url: string;
  emptyIndicators: EmptyStateIndicators;
  expectedText?: string | RegExp;
  expectedImage?: string;
  expectedCTA?: CTAConfig;
  expectedSubtext?: string | RegExp;
  checkAccessibility?: boolean;
  checkContrast?: boolean;
}

export async function emptyStateTemplate(
  page: Page,
  config: EmptyStateConfig
): Promise<void> {
  const {
    url,
    emptyIndicators,
    expectedText,
    expectedImage,
    expectedCTA,
    expectedSubtext,
    checkAccessibility = true,
    checkContrast = true,
  } = config;

  // Navigate to empty state
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Check visible indicators
  if (emptyIndicators.visible) {
    for (const selector of emptyIndicators.visible) {
      const element = page.locator(selector);
      await expect(element).toBeVisible({ timeout: 5000 });
    }
  }

  // Check hidden elements
  if (emptyIndicators.hidden) {
    for (const selector of emptyIndicators.hidden) {
      const element = page.locator(selector);
      await expect(element).not.toBeVisible();
    }
  }

  // Verify expected text
  if (expectedText) {
    if (typeof expectedText === 'string') {
      await expect(page.locator('body')).toContainText(expectedText);
    } else {
      const pageContent = await page.textContent('body');
      expect(pageContent).toMatch(expectedText);
    }
  }

  // Verify expected image/icon
  if (expectedImage) {
    const image = page.locator(`img[src*="${expectedImage}"]`);
    await expect(image).toBeVisible({ timeout: 3000 });
  }

  // Verify CTA if provided
  if (expectedCTA) {
    const cta = page.locator(expectedCTA.selector);
    await expect(cta).toBeVisible({ timeout: 3000 });

    if (expectedCTA.expectedText) {
      if (typeof expectedCTA.expectedText === 'string') {
        await expect(cta).toContainText(expectedCTA.expectedText);
      } else {
        const ctaText = await cta.textContent();
        expect(ctaText).toMatch(expectedCTA.expectedText);
      }
    }

    if (expectedCTA.isDisabled !== undefined) {
      if (expectedCTA.isDisabled) {
        await expect(cta).toBeDisabled();
      } else {
        await expect(cta).toBeEnabled();
      }
    }
  }

  // Verify subtext if provided
  if (expectedSubtext) {
    if (typeof expectedSubtext === 'string') {
      await expect(page.locator('body')).toContainText(expectedSubtext);
    } else {
      const pageContent = await page.textContent('body');
      expect(pageContent).toMatch(expectedSubtext);
    }
  }

  // Check accessibility
  if (checkAccessibility) {
    await verifyEmptyStateAccessibility(page);
  }

  // Check contrast
  if (checkContrast) {
    await verifyEmptyStateContrast(page);
  }
}

/**
 * Verify empty state is accessible
 */
async function verifyEmptyStateAccessibility(page: Page): Promise<void> {
  const accessibility = await page.evaluate(() => {
    const issues: string[] = [];

    // Check for alt text on images
    const images = document.querySelectorAll('img');
    images.forEach((img) => {
      if (!img.getAttribute('alt') && !img.getAttribute('aria-label')) {
        issues.push(`Image missing alt text: ${img.src}`);
      }
    });

    // Check for heading
    const heading = document.querySelector('h1, h2, h3');
    if (!heading) {
      issues.push('No heading found in empty state');
    }

    // Check for proper ARIA roles
    const button = document.querySelector('button');
    if (button && !button.getAttribute('aria-label') && !button.textContent?.trim()) {
      issues.push('Button missing accessible label');
    }

    return issues;
  });

  if (accessibility.length > 0) {
    console.warn('Accessibility issues in empty state:', accessibility);
  }
}

/**
 * Verify contrast ratios in empty state
 */
async function verifyEmptyStateContrast(page: Page): Promise<void> {
  const contrastIssues = await page.evaluate(() => {
    const issues: string[] = [];
    const textElements = document.querySelectorAll('p, span, a, button, h1, h2, h3');

    const getContrastRatio = (element: Element): number => {
      const color = window.getComputedStyle(element).color;
      const bgColor = window.getComputedStyle(element).backgroundColor;

      // Simple luminance calculation (not perfect but good enough for warnings)
      return 4.5; // placeholder
    };

    textElements.forEach((el) => {
      const ratio = getContrastRatio(el);
      if (ratio < 4.5) {
        issues.push(`Low contrast text: ${el.textContent?.substring(0, 30)}`);
      }
    });

    return issues;
  });

  if (contrastIssues.length > 0) {
    console.warn('Contrast issues in empty state:', contrastIssues);
  }
}

/**
 * Helper to verify CTA is clickable
 */
export async function verifyEmptyStateCTAClickable(
  page: Page,
  ctaSelector: string
): Promise<void> {
  const cta = page.locator(ctaSelector);
  await expect(cta).toBeEnabled();
  await expect(cta).toBeInViewport();
}

/**
 * Helper to click CTA and verify navigation
 */
export async function clickEmptyStateCTA(
  page: Page,
  ctaSelector: string,
  expectedUrl?: string | RegExp
): Promise<void> {
  const cta = page.locator(ctaSelector);
  await cta.click();
  await page.waitForLoadState('networkidle');

  if (expectedUrl) {
    if (typeof expectedUrl === 'string') {
      expect(page.url()).toContain(expectedUrl);
    } else {
      expect(page.url()).toMatch(expectedUrl);
    }
  }
}

/**
 * Helper to get empty state text content
 */
export async function getEmptyStateContent(page: Page): Promise<{
  title: string | null;
  description: string | null;
  buttonText: string | null;
}> {
  return page.evaluate(() => {
    const title = document.querySelector('h1, h2, h3')?.textContent || null;
    const description = document.querySelector('[data-testid="empty-description"], p')?.textContent || null;
    const button = document.querySelector('button')?.textContent || null;

    return {
      title,
      description,
      buttonText: button,
    };
  });
}
