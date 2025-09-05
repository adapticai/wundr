import { Page, expect } from '@playwright/test';
import { TEST_CONFIG, DashboardName } from './test-config';

/**
 * Utility functions for cross-dashboard testing
 */

export class TestUtilities {
  constructor(private page: Page) {}

  /**
   * Check if a URL is accessible and returns expected status
   */
  async checkUrlAccessibility(url: string, expectedStatus: number = 200): Promise<boolean> {
    try {
      const response = await this.page.request.get(url);
      return response.status() === expectedStatus;
    } catch (error) {
      return false;
    }
  }

  /**
   * Perform comprehensive link checking on a page
   */
  async performLinkAudit(baseUrl: string): Promise<{
    workingLinks: string[];
    brokenLinks: string[];
    redirectLinks: string[];
  }> {
    await this.page.goto(baseUrl);
    
    const links = await this.page.locator('a[href]').all();
    const results = {
      workingLinks: [] as string[],
      brokenLinks: [] as string[],
      redirectLinks: [] as string[]
    };

    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('mailto:')) {
        const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
        
        try {
          const response = await this.page.request.get(fullUrl);
          if (response.ok()) {
            results.workingLinks.push(fullUrl);
          } else if (response.status() >= 300 && response.status() < 400) {
            results.redirectLinks.push(fullUrl);
          } else {
            results.brokenLinks.push(fullUrl);
          }
        } catch (error) {
          results.brokenLinks.push(fullUrl);
        }
      }
    }

    return results;
  }

  /**
   * Check for runtime JavaScript errors
   */
  async captureJSErrors(): Promise<string[]> {
    const errors: string[] = [];

    this.page.on('pageerror', (error) => {
      errors.push(`JavaScript Error: ${error.message}`);
    });

    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(`Console Error: ${msg.text()}`);
      }
    });

    return errors;
  }

  /**
   * Monitor network requests for failures
   */
  async monitorNetworkRequests(): Promise<{
    failed: string[];
    slow: string[];
    successful: string[];
  }> {
    const results = {
      failed: [] as string[],
      slow: [] as string[],
      successful: [] as string[]
    };

    this.page.on('response', (response) => {
      const url = response.url();
      const timing = response.request().timing();
      const responseTime = timing?.responseEnd ? timing.responseEnd - timing.requestStart : 0;

      if (!response.ok()) {
        results.failed.push(`${url} - ${response.status()}`);
      } else if (responseTime > 5000) { // Slow requests > 5s
        results.slow.push(`${url} - ${responseTime}ms`);
      } else {
        results.successful.push(url);
      }
    });

    return results;
  }

  /**
   * Check component rendering and visibility
   */
  async validateComponentsRendered(selectors: string[]): Promise<{
    rendered: string[];
    missing: string[];
  }> {
    const results = {
      rendered: [] as string[],
      missing: [] as string[]
    };

    for (const selector of selectors) {
      const element = this.page.locator(selector);
      const count = await element.count();
      
      if (count > 0) {
        results.rendered.push(selector);
      } else {
        results.missing.push(selector);
      }
    }

    return results;
  }

  /**
   * Performance monitoring
   */
  async measurePagePerformance(): Promise<{
    loadTime: number;
    domContentLoaded: number;
    firstContentfulPaint: number;
    resourceCount: number;
  }> {
    const performanceTiming = await this.page.evaluate(() => {
      return JSON.parse(JSON.stringify(performance.timing));
    });

    const performanceMetrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstContentfulPaint: 0, // Would need additional polyfill for FCP
        resourceCount: performance.getEntriesByType('resource').length
      };
    });

    return performanceMetrics;
  }

  /**
   * Accessibility basic checks
   */
  async checkBasicAccessibility(): Promise<{
    missingAltText: number;
    missingAriaLabels: number;
    focusableElements: number;
    headingStructure: string[];
  }> {
    const missingAltText = await this.page.locator('img:not([alt])').count();
    const missingAriaLabels = await this.page.locator('button:not([aria-label]):not([aria-labelledby])').count();
    const focusableElements = await this.page.locator('a, button, input, select, textarea, [tabindex]').count();
    
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').allTextContents();

    return {
      missingAltText,
      missingAriaLabels,
      focusableElements,
      headingStructure: headings
    };
  }

  /**
   * API endpoint health checks
   */
  async checkAPIEndpoints(endpoints: string[], baseUrl: string): Promise<{
    healthy: string[];
    unhealthy: string[];
    errors: string[];
  }> {
    const results = {
      healthy: [] as string[],
      unhealthy: [] as string[],
      errors: [] as string[]
    };

    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint}`;
      
      try {
        const response = await this.page.request.get(url);
        if (response.ok()) {
          results.healthy.push(endpoint);
        } else {
          results.unhealthy.push(`${endpoint} - ${response.status()}`);
        }
      } catch (error) {
        results.errors.push(`${endpoint} - ${error}`);
      }
    }

    return results;
  }

  /**
   * Mobile responsiveness check
   */
  async checkMobileResponsiveness(): Promise<{
    viewportWidths: number[];
    layoutBreakpoints: { width: number; issues: string[] }[];
  }> {
    const viewportWidths = [320, 768, 1024, 1440];
    const layoutBreakpoints = [];

    for (const width of viewportWidths) {
      await this.page.setViewportSize({ width, height: 800 });
      await this.page.waitForTimeout(1000); // Wait for layout adjustment

      const issues = [];
      
      // Check for horizontal scroll
      const hasHorizontalScroll = await this.page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      if (hasHorizontalScroll) {
        issues.push('Horizontal scrollbar present');
      }

      // Check for overlapping elements (basic check)
      const overlappingElements = await this.page.locator('[style*="position: fixed"], [style*="position: absolute"]').count();
      if (overlappingElements > 10) { // Arbitrary threshold
        issues.push('Potential overlapping elements detected');
      }

      layoutBreakpoints.push({ width, issues });
    }

    return { viewportWidths, layoutBreakpoints };
  }
}

/**
 * Cross-dashboard integration utilities
 */
export class CrossDashboardTesting {
  static async compareDashboards(
    page1: Page,
    page2: Page,
    dashboard1: DashboardName,
    dashboard2: DashboardName
  ) {
    const url1 = TEST_CONFIG.dashboards[dashboard1].baseURL;
    const url2 = TEST_CONFIG.dashboards[dashboard2].baseURL;

    await page1.goto(url1);
    await page2.goto(url2);

    // Compare loading times
    const perf1 = await page1.evaluate(() => performance.timing.loadEventEnd - performance.timing.navigationStart);
    const perf2 = await page2.evaluate(() => performance.timing.loadEventEnd - performance.timing.navigationStart);

    // Compare page titles
    const title1 = await page1.title();
    const title2 = await page2.title();

    // Compare basic structure
    const links1 = await page1.locator('a').count();
    const links2 = await page2.locator('a').count();

    return {
      performance: { [dashboard1]: perf1, [dashboard2]: perf2 },
      titles: { [dashboard1]: title1, [dashboard2]: title2 },
      linkCounts: { [dashboard1]: links1, [dashboard2]: links2 }
    };
  }
}