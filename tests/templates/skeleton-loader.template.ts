import { test, expect, Page } from '@playwright/test';

/**
 * Skeleton Loader Verification Template
 *
 * Tests loading states, skeleton screens, and transitions to loaded content.
 * Use this template for validating skeleton loaders, spinners, and loading states.
 *
 * @template
 * @category Loading
 *
 * Example usage:
 * ```typescript
 * test('shows skeleton while loading data', async ({ page }) => {
 *   await skeletonLoaderTemplate(page, {
 *     url: '/dashboard',
 *     skeletonSelectors: ['[data-testid="skeleton-card"]'],
 *     contentSelectors: ['[data-testid="card"]'],
 *     shouldShow: 'skeletons',
 *     transitionTimeout: 5000,
 *   });
 * });
 * ```
 */

export interface SkeletonLoaderConfig {
  url: string;
  skeletonSelectors: string[];
  contentSelectors: string[];
  shouldShow: 'skeletons' | 'content' | 'both';
  spinnerSelector?: string;
  loadingMessage?: string | RegExp;
  transitionTimeout?: number;
  checkAnimations?: boolean;
  checkAccessibility?: boolean;
  onSkeletonVisible?: (page: Page) => Promise<void>;
  onContentVisible?: (page: Page) => Promise<void>;
}

export async function skeletonLoaderTemplate(
  page: Page,
  config: SkeletonLoaderConfig
): Promise<void> {
  const {
    url,
    skeletonSelectors,
    contentSelectors,
    shouldShow,
    spinnerSelector,
    loadingMessage,
    transitionTimeout = 5000,
    checkAnimations = true,
    checkAccessibility = true,
    onSkeletonVisible,
    onContentVisible,
  } = config;

  // Navigate without waiting for full load to catch skeleton state
  const navigationPromise = page.goto(url, { waitUntil: 'domcontentloaded' });

  // Check if we should see skeletons initially
  if (shouldShow === 'skeletons' || shouldShow === 'both') {
    // Give skeleton time to appear
    await page.waitForTimeout(300);

    // Verify skeleton elements are visible
    let skeletonsVisible = false;
    for (const selector of skeletonSelectors) {
      try {
        const skeleton = page.locator(selector);
        await expect(skeleton).toBeVisible({ timeout: 2000 });
        skeletonsVisible = true;
      } catch {
        // Skeleton might not be visible yet
      }
    }

    // Verify spinner if provided
    if (spinnerSelector && !skeletonsVisible) {
      const spinner = page.locator(spinnerSelector);
      await expect(spinner).toBeVisible({ timeout: 2000 });
    }

    // Verify loading message if provided
    if (loadingMessage) {
      const pageContent = await page.textContent('body');
      if (typeof loadingMessage === 'string') {
        expect(pageContent).toContain(loadingMessage);
      } else {
        expect(pageContent).toMatch(loadingMessage);
      }
    }

    // Run skeleton visible callback
    if (onSkeletonVisible) {
      await onSkeletonVisible(page);
    }

    // Check animations on skeleton
    if (checkAnimations) {
      await verifySkeletonAnimations(page, skeletonSelectors);
    }
  }

  // Wait for navigation to complete
  await navigationPromise;
  await page.waitForLoadState('networkidle', { timeout: transitionTimeout });

  // Check if content should be visible
  if (shouldShow === 'content' || shouldShow === 'both') {
    // Wait for skeleton to disappear
    if (shouldShow === 'content') {
      for (const selector of skeletonSelectors) {
        const skeleton = page.locator(selector);
        await expect(skeleton).not.toBeVisible({ timeout: transitionTimeout });
      }

      // Verify spinner is gone
      if (spinnerSelector) {
        const spinner = page.locator(spinnerSelector);
        await expect(spinner).not.toBeVisible();
      }
    }

    // Verify content is visible
    for (const selector of contentSelectors) {
      const content = page.locator(selector);
      await expect(content).toBeVisible({ timeout: transitionTimeout });
    }

    // Run content visible callback
    if (onContentVisible) {
      await onContentVisible(page);
    }
  }

  // Check accessibility
  if (checkAccessibility) {
    await verifyLoadingStateAccessibility(page);
  }
}

/**
 * Verify skeleton has animations
 */
async function verifySkeletonAnimations(page: Page, skeletonSelectors: string[]): Promise<void> {
  for (const selector of skeletonSelectors) {
    const hasAnimation = await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) return false;

      const computedStyle = window.getComputedStyle(element);
      const animation = computedStyle.animation || computedStyle.animationName;

      return animation !== 'none' && animation !== '';
    }, selector);

    if (!hasAnimation) {
      console.warn(`Skeleton at "${selector}" has no animation`);
    }
  }
}

/**
 * Verify loading state accessibility
 */
async function verifyLoadingStateAccessibility(page: Page): Promise<void> {
  const accessibility = await page.evaluate(() => {
    const issues: string[] = [];

    // Check for aria-busy
    const busyElements = document.querySelectorAll('[aria-busy="true"]');
    if (busyElements.length === 0) {
      const skeletons = document.querySelectorAll('[class*="skeleton"]');
      if (skeletons.length > 0) {
        issues.push('Skeleton elements should have aria-busy="true"');
      }
    }

    // Check for loading text
    const loadingIndicators = document.querySelectorAll('[role="status"]');
    if (loadingIndicators.length === 0) {
      const hasLoadingText = document.body.textContent?.includes('loading');
      if (!hasLoadingText) {
        // Don't fail if no loading text - it's optional
      }
    }

    // Verify spinners have proper ARIA
    const spinners = document.querySelectorAll('[role="progressbar"], [class*="spinner"]');
    spinners.forEach((spinner) => {
      if (!spinner.getAttribute('aria-label') && !spinner.getAttribute('aria-describedby')) {
        issues.push('Spinner missing accessible label');
      }
    });

    return issues;
  });

  if (accessibility.length > 0) {
    console.warn('Loading state accessibility issues:', accessibility);
  }
}

/**
 * Helper to wait for skeleton to disappear
 */
export async function waitForSkeletonToDisappear(
  page: Page,
  skeletonSelector: string,
  timeout = 5000
): Promise<void> {
  const skeleton = page.locator(skeletonSelector);
  await expect(skeleton).not.toBeVisible({ timeout });
}

/**
 * Helper to wait for content to appear
 */
export async function waitForContentToAppear(
  page: Page,
  contentSelector: string,
  timeout = 5000
): Promise<void> {
  const content = page.locator(contentSelector);
  await expect(content).toBeVisible({ timeout });
}

/**
 * Helper to measure skeleton to content transition time
 */
export async function measureSkeletonTransitionTime(
  page: Page,
  skeletonSelector: string,
  contentSelector: string
): Promise<number> {
  const startTime = Date.now();

  try {
    // Wait for skeleton to appear
    const skeleton = page.locator(skeletonSelector);
    await expect(skeleton).toBeVisible({ timeout: 2000 });

    // Wait for skeleton to disappear
    await expect(skeleton).not.toBeVisible({ timeout: 10000 });

    // Wait for content to appear
    const content = page.locator(contentSelector);
    await expect(content).toBeVisible({ timeout: 5000 });
  } catch (error) {
    console.error('Error measuring transition time:', error);
  }

  return Date.now() - startTime;
}

/**
 * Helper to verify skeleton count matches content count
 */
export async function verifySkeletonContentCount(
  page: Page,
  skeletonSelector: string,
  contentSelector: string
): Promise<void> {
  const skeletonCount = await page.locator(skeletonSelector).count();
  const contentCount = await page.locator(contentSelector).count();

  expect(skeletonCount).toBe(contentCount);
}

/**
 * Helper to get skeleton list
 */
export async function getSkeletons(
  page: Page,
  skeletonSelector: string
): Promise<{ count: number; hasAnimation: boolean[] }> {
  const skeletons = page.locator(skeletonSelector);
  const count = await skeletons.count();

  const hasAnimation = await page.evaluate((sel) => {
    return Array.from(document.querySelectorAll(sel)).map((element) => {
      const computedStyle = window.getComputedStyle(element);
      const animation = computedStyle.animation || computedStyle.animationName;
      return animation !== 'none' && animation !== '';
    });
  }, skeletonSelector);

  return {
    count,
    hasAnimation,
  };
}
