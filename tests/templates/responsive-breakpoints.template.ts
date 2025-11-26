import { test, expect, Page, BrowserContext, devices, Browser } from '@playwright/test';

/**
 * Responsive Breakpoints Template
 *
 * Tests responsive design across multiple screen sizes and device types.
 * Use this template for validating layouts work correctly at all breakpoints.
 *
 * @template
 * @category Responsive
 *
 * Example usage:
 * ```typescript
 * test('dashboard is responsive across all breakpoints', async ({ page }) => {
 *   await responsiveBreakpointsTemplate(page, {
 *     url: '/dashboard',
 *     breakpoints: ['mobile', 'tablet', 'desktop'],
 *     elementVisibility: {
 *       mobile: {
 *         visible: ['[data-testid="mobile-nav"]'],
 *         hidden: ['[data-testid="desktop-nav"]'],
 *       },
 *       desktop: {
 *         visible: ['[data-testid="desktop-nav"]'],
 *         hidden: ['[data-testid="mobile-nav"]'],
 *       },
 *     },
 *   });
 * });
 * ```
 */

export type BreakpointName = 'mobile' | 'tablet' | 'desktop' | 'wide' | 'custom';

export interface Breakpoint {
  name: BreakpointName;
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

export interface BreakpointVisibility {
  visible?: string[];
  hidden?: string[];
}

export interface ResponsiveBreakpointsConfig {
  url: string;
  breakpoints?: BreakpointName[] | Breakpoint[];
  elementVisibility?: Record<BreakpointName, BreakpointVisibility>;
  customBreakpoints?: Breakpoint[];
  noLayoutShift?: boolean;
  checkTextReadability?: boolean;
  checkTouchTargets?: boolean;
  minTouchTargetSize?: number;
  onBreakpointChange?: (breakpoint: Breakpoint) => Promise<void>;
}

// Default breakpoints
const DEFAULT_BREAKPOINTS: Record<BreakpointName, Breakpoint> = {
  mobile: {
    name: 'mobile',
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  tablet: {
    name: 'tablet',
    width: 768,
    height: 1024,
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    name: 'desktop',
    width: 1280,
    height: 720,
    isMobile: false,
    hasTouch: false,
  },
  wide: {
    name: 'wide',
    width: 1920,
    height: 1080,
    isMobile: false,
    hasTouch: false,
  },
  custom: {
    name: 'custom',
    width: 1024,
    height: 768,
    isMobile: false,
    hasTouch: false,
  },
};

export async function responsiveBreakpointsTemplate(
  page: Page,
  config: ResponsiveBreakpointsConfig
): Promise<void> {
  const {
    url,
    breakpoints = ['mobile', 'tablet', 'desktop'],
    elementVisibility = {},
    customBreakpoints = [],
    noLayoutShift = true,
    checkTextReadability = true,
    checkTouchTargets = true,
    minTouchTargetSize = 48,
    onBreakpointChange,
  } = config;

  // Resolve breakpoints
  const resolvedBreakpoints: Breakpoint[] = (breakpoints as (BreakpointName | Breakpoint)[]).map(
    (bp) => {
      if (typeof bp === 'string') {
        return DEFAULT_BREAKPOINTS[bp];
      }
      return bp;
    }
  );

  // Navigate to page once
  await page.goto(url, { waitUntil: 'networkidle' });

  // Test each breakpoint
  for (const breakpoint of resolvedBreakpoints) {
    // Set viewport size
    await page.setViewportSize({
      width: breakpoint.width,
      height: breakpoint.height,
    });

    // Set device scale factor if provided
    if (breakpoint.deviceScaleFactor) {
      await page.evaluate((dpr) => {
        Object.defineProperty(window, 'devicePixelRatio', {
          value: dpr,
          writable: false,
        });
      }, breakpoint.deviceScaleFactor);
    }

    // Wait for layout to settle
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Run custom callback
    if (onBreakpointChange) {
      await onBreakpointChange(breakpoint);
    }

    // Check element visibility
    const visibility = elementVisibility[breakpoint.name];
    if (visibility) {
      // Check visible elements
      if (visibility.visible) {
        for (const selector of visibility.visible) {
          const element = page.locator(selector);
          await expect(element).toBeVisible({ timeout: 3000 });
        }
      }

      // Check hidden elements
      if (visibility.hidden) {
        for (const selector of visibility.hidden) {
          const element = page.locator(selector);
          await expect(element).not.toBeVisible();
        }
      }
    }

    // Check for layout shift
    if (noLayoutShift) {
      const layoutShift = await page.evaluate(() => {
        return performance
          .getEntries()
          .filter((entry) => entry.entryType === 'layout-shift')
          .reduce((sum, entry) => sum + (entry as any).hadRecentInput === false ? (entry as any).value : 0, 0);
      });
      expect(layoutShift).toBeLessThan(0.1);
    }

    // Check text readability
    if (checkTextReadability) {
      await checkPageTextReadability(page);
    }

    // Check touch targets
    if (checkTouchTargets && (breakpoint.isMobile || breakpoint.hasTouch)) {
      await checkTouchTargetSizes(page, minTouchTargetSize);
    }
  }
}

/**
 * Helper to check text readability
 */
async function checkPageTextReadability(page: Page): Promise<void> {
  const issues = await page.evaluate(() => {
    const issues: string[] = [];
    const textElements = document.querySelectorAll('p, span, a, button, label');

    textElements.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const fontSize = parseFloat(computed.fontSize);
      const lineHeight = parseFloat(computed.lineHeight);
      const contrast = computed.color;

      // Check minimum font size
      if (fontSize < 12) {
        issues.push(`Element has font size < 12px: ${el.textContent?.substring(0, 30)}`);
      }

      // Check line height
      if (lineHeight / fontSize < 1.2) {
        issues.push(`Element has inadequate line height: ${el.textContent?.substring(0, 30)}`);
      }
    });

    return issues;
  });

  if (issues.length > 0) {
    console.warn('Text readability issues:', issues);
  }
}

/**
 * Helper to check touch target sizes
 */
async function checkTouchTargetSizes(page: Page, minSize: number): Promise<void> {
  const smallTargets = await page.evaluate((minSize) => {
    const targets: string[] = [];
    const interactiveElements = document.querySelectorAll('button, a, input, [role="button"]');

    interactiveElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < minSize || rect.height < minSize) {
        targets.push(`${el.tagName} (${rect.width}x${rect.height}px)`);
      }
    });

    return targets;
  }, minSize);

  if (smallTargets.length > 0) {
    console.warn(`Touch targets smaller than ${minSize}px:`, smallTargets);
  }
}

/**
 * Helper to test specific breakpoint
 */
export async function testBreakpoint(
  page: Page,
  breakpoint: Breakpoint
): Promise<void> {
  await page.setViewportSize({
    width: breakpoint.width,
    height: breakpoint.height,
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

/**
 * Helper to get element visibility at breakpoint
 */
export async function getElementVisibilityAtBreakpoint(
  page: Page,
  selector: string
): Promise<boolean> {
  const element = page.locator(selector);
  try {
    await expect(element).toBeVisible({ timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to measure layout shift
 */
export async function getLayoutShiftScore(page: Page): Promise<number> {
  return page.evaluate(() => {
    return performance
      .getEntries()
      .filter((entry) => entry.entryType === 'layout-shift')
      .reduce((sum, entry) => sum + (entry as any).hadRecentInput === false ? (entry as any).value : 0, 0);
  });
}
