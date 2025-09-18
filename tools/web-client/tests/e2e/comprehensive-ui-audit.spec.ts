import { test, expect, Page } from '@playwright/test';
import { TestUtilities } from './helpers/test-utilities';
import { WebClientDashboardPage } from './helpers/page-objects';
import { TEST_CONFIG } from './helpers/test-config';

/**
 * Comprehensive UI Audit Test Suite
 * Tests all major functionality across both dashboards
 */

test.describe('Comprehensive UI Audit', () => {
  let testUtils: TestUtilities;
  let dashboardPage: WebClientDashboardPage;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
    dashboardPage = new WebClientDashboardPage(page);
  });

  test.describe('Web Client Dashboard (Port 3000)', () => {
    test('should load all routes without errors', async ({ page }) => {
      const routes = TEST_CONFIG.routes.webClient;
      const failedRoutes: string[] = [];
      const jsErrors: string[] = [];

      // Set up error monitoring
      page.on('pageerror', (error) => {
        jsErrors.push(`${page.url()}: ${error.message}`);
      });

      for (const route of routes) {
        try {
          await dashboardPage.goto(route);
          await dashboardPage.waitForPageLoad();
          
          // Validate basic page structure
          await expect(page.locator('body')).toBeVisible();
          
          // Check page doesn't have critical errors
          const title = await page.title();
          expect(title).toBeTruthy();
          
        } catch (_error) {
          failedRoutes.push(`${route}: ${_error}`);
        }
      }

      // Report results
      if (failedRoutes.length > 0) {
        console.log('Failed Routes:', failedRoutes);
      }
      if (jsErrors.length > 0) {
        console.log('JavaScript Errors:', jsErrors);
      }

      expect(failedRoutes.length).toBeLessThan(routes.length * 0.1); // Allow up to 10% failure rate
      expect(jsErrors.length).toBeLessThan(5); // Allow minimal JS errors
    });

    test('should have working navigation between main sections', async ({ page }) => {
      await dashboardPage.goto('/dashboard');
      
      const mainSections = [
        { name: 'Analysis', path: '/dashboard/analysis' },
        { name: 'Files', path: '/dashboard/files' },
        { name: 'Performance', path: '/dashboard/performance' },
        { name: 'Quality', path: '/dashboard/quality' },
        { name: 'Reports', path: '/dashboard/reports' }
      ];

      for (const section of mainSections) {
        // Navigate to section
        await page.click(`[href="${section.path}"]`);
        await dashboardPage.waitForPageLoad();
        
        // Verify we're on the correct page
        expect(page.url()).toContain(section.path);
        
        // Verify page content loaded
        await expect(page.locator('main, [role="main"]')).toBeVisible();
      }
    });

    test('should load dashboard charts and visualizations', async ({ page }) => {
      await dashboardPage.goto('/dashboard');
      
      // Wait for potential async data loading
      await page.waitForTimeout(2000);
      
      // Check for common chart containers
      const chartSelectors = [
        '.recharts-wrapper',
        '.chart-container',
        'canvas',
        'svg',
        '.visualization'
      ];

      let chartsFound = 0;
      for (const selector of chartSelectors) {
        const count = await page.locator(selector).count();
        chartsFound += count;
      }

      // Should have at least some visualizations
      expect(chartsFound).toBeGreaterThan(0);
    });
  });

  test.describe('Cross-Dashboard Link Audit', () => {
    test('should identify broken links across web client', async ({ page }) => {
      const linkAudit = await testUtils.performLinkAudit(TEST_CONFIG.dashboards.webClient.baseURL);
      
      console.log(`Working Links: ${linkAudit.workingLinks.length}`);
      console.log(`Broken Links: ${linkAudit.brokenLinks.length}`);
      console.log(`Redirect Links: ${linkAudit.redirectLinks.length}`);

      if (linkAudit.brokenLinks.length > 0) {
        console.log('Broken Links Found:', linkAudit.brokenLinks);
      }

      // Allow some broken links but not too many
      expect(linkAudit.brokenLinks.length).toBeLessThan(5);
    });
  });

  test.describe('Performance and Error Monitoring', () => {
    test('should monitor page performance', async ({ page }) => {
      await dashboardPage.goto('/dashboard');
      
      const performance = await testUtils.measurePagePerformance();
      
      console.log('Performance Metrics:', performance);
      
      // Performance thresholds
      expect(performance.loadTime).toBeLessThan(10000); // 10 seconds
      expect(performance.resourceCount).toBeLessThan(200); // Reasonable resource count
    });

    test('should check for JavaScript runtime errors', async ({ page }) => {
      const errors = await testUtils.captureJSErrors();
      
      // Navigate through main sections to trigger any JS errors
      const routes = ['/dashboard', '/dashboard/analysis', '/dashboard/files', '/dashboard/performance'];
      
      for (const route of routes) {
        await dashboardPage.goto(route);
        await page.waitForTimeout(1000);
      }

      if (errors.length > 0) {
        console.log('JavaScript Errors Found:', errors);
      }

      // Allow minimal errors but should be mostly error-free
      expect(errors.length).toBeLessThan(3);
    });

    test('should monitor network requests for failures', async ({ page }) => {
      const networkResults = await testUtils.monitorNetworkRequests();
      
      await dashboardPage.goto('/dashboard');
      await page.waitForTimeout(3000); // Wait for API calls
      
      if (networkResults.failed.length > 0) {
        console.log('Failed Network Requests:', networkResults.failed);
      }
      
      if (networkResults.slow.length > 0) {
        console.log('Slow Network Requests:', networkResults.slow);
      }

      // Should have minimal network failures
      expect(networkResults.failed.length).toBeLessThan(10);
    });
  });

  test.describe('Component Validation', () => {
    test('should validate essential UI components are rendered', async ({ page }) => {
      await dashboardPage.goto('/dashboard');
      
      const essentialComponents = [
        'nav, [role="navigation"]',
        'main, [role="main"]',
        'header, [role="banner"]',
        'button',
        'a[href]',
        '[data-testid]'
      ];

      const componentResults = await testUtils.validateComponentsRendered(essentialComponents);
      
      console.log('Rendered Components:', componentResults.rendered);
      console.log('Missing Components:', componentResults.missing);

      // Most essential components should be present
      expect(componentResults.rendered.length).toBeGreaterThan(essentialComponents.length * 0.5);
    });

    test('should check for missing images', async ({ page }) => {
      await dashboardPage.goto('/dashboard');
      await dashboardPage.goto('/dashboard/about'); // Page likely to have images
      
      const images = await page.locator('img').all();
      const missingImages: string[] = [];

      for (const img of images) {
        const src = await img.getAttribute('src');
        if (src) {
          try {
            const response = await page.request.get(src);
            if (!response.ok()) {
              missingImages.push(src);
            }
          } catch (_error) {
            missingImages.push(src);
          }
        }
      }

      if (missingImages.length > 0) {
        console.log('Missing Images:', missingImages);
      }

      expect(missingImages.length).toBeLessThan(3);
    });
  });

  test.describe('API Endpoint Health Checks', () => {
    test('should validate API endpoints are accessible', async ({ page }) => {
      const apiEndpoints = [
        '/api/analysis',
        '/api/files/list',
        '/api/performance',
        '/api/quality',
        '/api/reports',
        '/api/git',
        '/api/config'
      ];

      const apiResults = await testUtils.checkAPIEndpoints(apiEndpoints, TEST_CONFIG.dashboards.webClient.baseURL);
      
      console.log('Healthy APIs:', apiResults.healthy);
      console.log('Unhealthy APIs:', apiResults.unhealthy);
      console.log('API Errors:', apiResults.errors);

      // Most APIs should be healthy
      expect(apiResults.healthy.length).toBeGreaterThan(apiEndpoints.length * 0.5);
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should be responsive across different screen sizes', async ({ page }) => {
      await dashboardPage.goto('/dashboard');
      
      const responsiveness = await testUtils.checkMobileResponsiveness();
      
      console.log('Responsiveness Results:', responsiveness);

      // Check that major breakpoints don't have critical issues
      const criticalIssues = responsiveness.layoutBreakpoints.filter(
        bp => bp.issues.some(issue => issue.includes('Horizontal scrollbar'))
      );

      expect(criticalIssues.length).toBeLessThan(2); // Allow some responsiveness issues
    });
  });

  test.describe('Basic Accessibility', () => {
    test('should meet basic accessibility requirements', async ({ page }) => {
      await dashboardPage.goto('/dashboard');
      
      const accessibility = await testUtils.checkBasicAccessibility();
      
      console.log('Accessibility Results:', accessibility);

      // Basic accessibility requirements
      expect(accessibility.missingAltText).toBeLessThan(5);
      expect(accessibility.focusableElements).toBeGreaterThan(5);
      expect(accessibility.headingStructure.length).toBeGreaterThan(0);
    });
  });
});