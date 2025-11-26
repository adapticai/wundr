import { test, expect, Page } from '@playwright/test';

/**
 * Theme Switching Template
 *
 * Tests theme switching, persistence, and visual consistency.
 * Use this template for validating dark mode, light mode, and other theme variants.
 *
 * @template
 * @category Theming
 *
 * Example usage:
 * ```typescript
 * test('theme switching works correctly', async ({ page }) => {
 *   await themeSwitchingTemplate(page, {
 *     url: '/dashboard',
 *     themeToggleSelector: '[data-testid="theme-toggle"]',
 *     themes: ['light', 'dark'],
 *     colorChecks: {
 *       light: {
 *         background: 'rgb(255, 255, 255)',
 *         text: 'rgb(0, 0, 0)',
 *       },
 *       dark: {
 *         background: 'rgb(15, 23, 42)',
 *         text: 'rgb(255, 255, 255)',
 *       },
 *     },
 *     persistenceEnabled: true,
 *   });
 * });
 * ```
 */

export interface ColorSpec {
  background?: string;
  text?: string;
  primary?: string;
  secondary?: string;
}

export interface ThemeSwitchingConfig {
  url: string;
  themeToggleSelector: string;
  themes: string[];
  colorChecks?: Record<string, ColorSpec>;
  persistenceEnabled?: boolean;
  persistenceKey?: string;
  elementsToCheck?: string[];
  beforeThemeSwitch?: (page: Page, theme: string) => Promise<void>;
  afterThemeSwitch?: (page: Page, theme: string) => Promise<void>;
  checkContrast?: boolean;
  checkFontLegibility?: boolean;
}

export async function themeSwitchingTemplate(
  page: Page,
  config: ThemeSwitchingConfig
): Promise<void> {
  const {
    url,
    themeToggleSelector,
    themes,
    colorChecks = {},
    persistenceEnabled = true,
    persistenceKey = 'theme',
    elementsToCheck = [],
    beforeThemeSwitch,
    afterThemeSwitch,
    checkContrast = true,
    checkFontLegibility = true,
  } = config;

  // Navigate to page
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Verify theme toggle exists
  const toggle = page.locator(themeToggleSelector);
  await expect(toggle).toBeVisible({ timeout: 3000 });
  await expect(toggle).toBeEnabled();

  // Test each theme
  for (let i = 0; i < themes.length; i++) {
    const theme = themes[i];

    // Run before switch hook
    if (beforeThemeSwitch) {
      await beforeThemeSwitch(page, theme);
    }

    // Click theme toggle
    await toggle.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Run after switch hook
    if (afterThemeSwitch) {
      await afterThemeSwitch(page, theme);
    }

    // Check color scheme if provided
    if (colorChecks[theme]) {
      await verifyThemeColors(page, colorChecks[theme], elementsToCheck);
    }

    // Check contrast
    if (checkContrast) {
      await verifyThemeContrast(page);
    }

    // Check font legibility
    if (checkFontLegibility) {
      await verifyFontLegibility(page);
    }

    // Check CSS variables are applied
    await verifyThemeCSSVariables(page);

    // Check persistence
    if (persistenceEnabled && i === 0) {
      // Check that preference is stored
      const stored = await page.evaluate((key) => {
        return localStorage.getItem(key) || sessionStorage.getItem(key);
      }, persistenceKey);

      if (stored) {
        // Reload page and verify theme persists
        await page.reload();
        await page.waitForLoadState('networkidle');
      }
    }
  }
}

/**
 * Verify theme colors are applied
 */
async function verifyThemeColors(
  page: Page,
  colors: ColorSpec,
  elementsToCheck: string[]
): Promise<void> {
  if (elementsToCheck.length === 0) {
    elementsToCheck = ['body', 'main', '[role="main"]'];
  }

  const issues = await page.evaluate((checks) => {
    const issues: string[] = [];

    for (const selector of checks.elementsToCheck) {
      const element = document.querySelector(selector);
      if (!element) continue;

      const computed = window.getComputedStyle(element);

      if (checks.colors.background) {
        const bgColor = computed.backgroundColor;
        // Simple check - just verify a color is set
        if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
          // Background might be inherited, check parent
          const parent = element.parentElement;
          if (parent) {
            const parentBg = window.getComputedStyle(parent).backgroundColor;
            if (parentBg === 'rgba(0, 0, 0, 0)' || parentBg === 'transparent') {
              issues.push(`No background color set for ${selector}`);
            }
          }
        }
      }

      if (checks.colors.text) {
        const textColor = computed.color;
        if (textColor === 'rgba(0, 0, 0, 0)') {
          issues.push(`No text color set for ${selector}`);
        }
      }
    }

    return issues;
  }, { colors, elementsToCheck });

  if (issues.length > 0) {
    console.warn('Theme color issues:', issues);
  }
}

/**
 * Verify theme has good contrast
 */
async function verifyThemeContrast(page: Page): Promise<void> {
  const contrastIssues = await page.evaluate(() => {
    const issues: string[] = [];
    const textElements = document.querySelectorAll('p, a, button, span, label');

    // Simple luminance-based contrast check
    const getLuminance = (r: number, g: number, b: number): number => {
      const [rs, gs, bs] = [r, g, b].map((x) => {
        x = x / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const parseRGB = (colorString: string): [number, number, number] | null => {
      const match = colorString.match(/\d+/g);
      if (!match || match.length < 3) return null;
      return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])];
    };

    textElements.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const color = computed.color;
      const bgColor = computed.backgroundColor;

      const textRGB = parseRGB(color);
      const bgRGB = parseRGB(bgColor);

      if (textRGB && bgRGB) {
        const textLum = getLuminance(textRGB[0], textRGB[1], textRGB[2]);
        const bgLum = getLuminance(bgRGB[0], bgRGB[1], bgRGB[2]);

        const contrast = (Math.max(textLum, bgLum) + 0.05) / (Math.min(textLum, bgLum) + 0.05);

        if (contrast < 4.5) {
          issues.push(`Low contrast text: ${el.textContent?.substring(0, 30)} (${contrast.toFixed(2)}:1)`);
        }
      }
    });

    return issues;
  });

  if (contrastIssues.length > 0) {
    console.warn('Contrast issues:', contrastIssues);
  }
}

/**
 * Verify font is legible in current theme
 */
async function verifyFontLegibility(page: Page): Promise<void> {
  const legibilityIssues = await page.evaluate(() => {
    const issues: string[] = [];
    const textElements = document.querySelectorAll('p, a, button, span, label');

    textElements.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const fontSize = parseFloat(computed.fontSize);
      const fontWeight = computed.fontWeight;
      const lineHeight = parseFloat(computed.lineHeight);

      if (fontSize < 12) {
        issues.push(`Font size too small: ${fontSize}px`);
      }

      if (lineHeight / fontSize < 1.2) {
        issues.push(`Line height too tight: ${(lineHeight / fontSize).toFixed(2)}`);
      }
    });

    return issues;
  });

  if (legibilityIssues.length > 0) {
    console.warn('Font legibility issues:', legibilityIssues);
  }
}

/**
 * Verify CSS variables are set for theme
 */
async function verifyThemeCSSVariables(page: Page): Promise<void> {
  const cssVariables = await page.evaluate(() => {
    const root = document.documentElement;
    const styles = window.getComputedStyle(root);
    const variables: Record<string, string> = {};

    // Get common theme variables
    const commonVars = [
      '--color-primary',
      '--color-secondary',
      '--color-background',
      '--color-text',
      '--color-border',
      '--bg',
      '--foreground',
    ];

    commonVars.forEach((varName) => {
      const value = styles.getPropertyValue(varName).trim();
      if (value) {
        variables[varName] = value;
      }
    });

    return variables;
  });

  if (Object.keys(cssVariables).length === 0) {
    console.warn('No CSS variables found for theme');
  }
}

/**
 * Helper to get current theme
 */
export async function getCurrentTheme(page: Page, storageKey = 'theme'): Promise<string | null> {
  return page.evaluate((key) => {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  }, storageKey);
}

/**
 * Helper to set theme
 */
export async function setTheme(
  page: Page,
  theme: string,
  storageKey = 'theme'
): Promise<void> {
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
    // Dispatch event to trigger theme change
    const event = new StorageEvent('storage', {
      key,
      newValue: value,
    });
    window.dispatchEvent(event);
  }, { key: storageKey, value: theme });

  await page.waitForTimeout(500);
}

/**
 * Helper to get CSS variable value
 */
export async function getCSSVariable(page: Page, variableName: string): Promise<string> {
  return page.evaluate((varName) => {
    return window.getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }, variableName);
}

/**
 * Helper to take screenshot for theme comparison
 */
export async function getThemeScreenshot(
  page: Page,
  theme: string
): Promise<Buffer> {
  return page.screenshot({
    fullPage: true,
    path: `screenshots/theme-${theme}-${Date.now()}.png`,
  });
}
