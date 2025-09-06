import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Portable accessibility tests using axe-core
 */

test.describe('Accessibility Tests', () => {
  test('homepage meets WCAG standards', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('all images have alt text', async ({ page }) => {
    await page.goto('/');
    
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      
      // Images should have alt text or be marked as decorative
      expect(alt !== null || role === 'presentation').toBeTruthy();
    }
  });

  test('forms have proper labels', async ({ page }) => {
    await page.goto('/');
    
    const inputs = await page.locator('input, select, textarea').all();
    
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      if (id) {
        // Check for associated label
        const label = await page.locator(`label[for="${id}"]`).count();
        const hasLabel = label > 0 || ariaLabel !== null || ariaLabelledBy !== null;
        expect(hasLabel).toBeTruthy();
      }
    }
  });

  test('focus is visible and logical', async ({ page }) => {
    await page.goto('/');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    
    // Check if focused element has visible outline
    const focusedElement = await page.evaluateHandle(() => document.activeElement);
    const hasOutline = await focusedElement.evaluate((el) => {
      if (!el) return false;
      const styles = window.getComputedStyle(el as Element);
      return styles.outlineStyle !== 'none' || styles.boxShadow !== 'none';
    });
    
    expect(hasOutline).toBeTruthy();
  });

  test('color contrast meets standards', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['color-contrast'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('page has proper heading structure', async ({ page }) => {
    await page.goto('/');
    
    // Check for h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThan(0);
    
    // Check heading hierarchy
    const headings = await page.evaluate(() => {
      const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(headingElements).map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent
      }));
    });
    
    // Verify no skipped heading levels
    let previousLevel = 0;
    for (const heading of headings) {
      expect(heading.level - previousLevel).toBeLessThanOrEqual(1);
      previousLevel = heading.level;
    }
  });
});