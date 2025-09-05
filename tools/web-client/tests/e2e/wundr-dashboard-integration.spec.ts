import { test, expect, chromium, Browser, BrowserContext, Page } from '@playwright/test';
import { WundrDashboardPage } from './helpers/page-objects';
import { TestUtilities, CrossDashboardTesting } from './helpers/test-utilities';
import { TEST_CONFIG } from './helpers/test-config';

/**
 * Integration tests between both dashboards
 * This requires both dashboards to be running simultaneously
 */

test.describe('Wundr Dashboard Integration Tests', () => {
  let browser: Browser;
  let wundrContext: BrowserContext;
  let webClientContext: BrowserContext;
  let wundrPage: Page;
  let webClientPage: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    wundrContext = await browser.newContext();
    webClientContext = await browser.newContext();
    wundrPage = await wundrContext.newPage();
    webClientPage = await webClientContext.newPage();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('should verify both dashboards are accessible', async () => {
    // Test Wundr Dashboard (port 3001)
    const wundrUtils = new TestUtilities(wundrPage);
    const wundrAccessible = await wundrUtils.checkUrlAccessibility(TEST_CONFIG.dashboards.wundr.baseURL);
    
    // Test Web Client Dashboard (port 3000)  
    const webClientUtils = new TestUtilities(webClientPage);
    const webClientAccessible = await webClientUtils.checkUrlAccessibility(TEST_CONFIG.dashboards.webClient.baseURL);

    console.log(`Wundr Dashboard (3001) accessible: ${wundrAccessible}`);
    console.log(`Web Client Dashboard (3000) accessible: ${webClientAccessible}`);

    // At least one dashboard should be running
    expect(wundrAccessible || webClientAccessible).toBeTruthy();
  });

  test('should compare dashboard performance', async () => {
    // Only run if both dashboards are accessible
    const wundrUtils = new TestUtilities(wundrPage);
    const webClientUtils = new TestUtilities(webClientPage);
    
    const wundrAccessible = await wundrUtils.checkUrlAccessibility(TEST_CONFIG.dashboards.wundr.baseURL);
    const webClientAccessible = await webClientUtils.checkUrlAccessibility(TEST_CONFIG.dashboards.webClient.baseURL);

    if (!wundrAccessible || !webClientAccessible) {
      test.skip();
      return;
    }

    const comparison = await CrossDashboardTesting.compareDashboards(
      wundrPage,
      webClientPage,
      'wundr',
      'webClient'
    );

    console.log('Dashboard Comparison:', comparison);

    // Both should have reasonable performance
    expect(comparison.performance.wundr).toBeLessThan(15000);
    expect(comparison.performance.webClient).toBeLessThan(15000);

    // Both should have titles
    expect(comparison.titles.wundr).toBeTruthy();
    expect(comparison.titles.webClient).toBeTruthy();
  });

  test('should validate Wundr dashboard routes', async () => {
    const wundrUtils = new TestUtilities(wundrPage);
    const accessible = await wundrUtils.checkUrlAccessibility(TEST_CONFIG.dashboards.wundr.baseURL);
    
    if (!accessible) {
      console.log('Wundr Dashboard not accessible, skipping test');
      test.skip();
      return;
    }

    const wundrDashboard = new WundrDashboardPage(wundrPage);
    const routes = TEST_CONFIG.routes.wundr;
    
    for (const route of routes) {
      await wundrDashboard.goto(route);
      await wundrDashboard.waitForPageLoad();
      
      // Basic validation
      await expect(wundrPage.locator('body')).toBeVisible();
      const title = await wundrPage.title();
      expect(title).toBeTruthy();
    }
  });

  test('should check for WebSocket functionality in Wundr dashboard', async () => {
    const wundrUtils = new TestUtilities(wundrPage);
    const accessible = await wundrUtils.checkUrlAccessibility(TEST_CONFIG.dashboards.wundr.baseURL);
    
    if (!accessible) {
      test.skip();
      return;
    }

    await wundrPage.goto(TEST_CONFIG.dashboards.wundr.baseURL + '/dashboard/overview');
    
    // Look for WebSocket connection indicators
    const wsIndicators = await wundrPage.locator('[data-testid*="websocket"], [data-testid*="realtime"], .connection-status').count();
    
    // Check for real-time badges or status indicators
    const realtimeBadges = await wundrPage.locator('text=connected, text=real-time, text=live').count();
    
    console.log(`WebSocket indicators found: ${wsIndicators}`);
    console.log(`Real-time badges found: ${realtimeBadges}`);

    // Should have some real-time functionality indicators
    expect(wsIndicators + realtimeBadges).toBeGreaterThan(0);
  });

  test('should validate dashboard-specific functionality', async () => {
    const webClientUtils = new TestUtilities(webClientPage);
    const webClientAccessible = await webClientUtils.checkUrlAccessibility(TEST_CONFIG.dashboards.webClient.baseURL);
    
    if (webClientAccessible) {
      // Test web client specific features
      await webClientPage.goto(TEST_CONFIG.dashboards.webClient.baseURL + '/dashboard/analysis');
      
      // Should have analysis-specific elements
      const analysisElements = await webClientPage.locator('.analysis-card, .summary-card, .chart-container').count();
      expect(analysisElements).toBeGreaterThan(0);
    }

    const wundrUtils = new TestUtilities(wundrPage);
    const wundrAccessible = await wundrUtils.checkUrlAccessibility(TEST_CONFIG.dashboards.wundr.baseURL);
    
    if (wundrAccessible) {
      // Test Wundr specific features
      await wundrPage.goto(TEST_CONFIG.dashboards.wundr.baseURL + '/dashboard/overview');
      
      // Should have real-time monitoring elements
      const realtimeElements = await wundrPage.locator('[data-testid*="realtime"], [data-testid*="metrics"], .real-time').count();
      console.log(`Real-time elements found: ${realtimeElements}`);
      
      // Expect some real-time dashboard elements
      expect(realtimeElements).toBeGreaterThan(0);
    }
  });

  test('should compare error rates between dashboards', async () => {
    const wundrUtils = new TestUtilities(wundrPage);
    const webClientUtils = new TestUtilities(webClientPage);
    
    const wundrAccessible = await wundrUtils.checkUrlAccessibility(TEST_CONFIG.dashboards.wundr.baseURL);
    const webClientAccessible = await webClientUtils.checkUrlAccessibility(TEST_CONFIG.dashboards.webClient.baseURL);

    const results = {
      wundr: { errors: 0, accessible: wundrAccessible },
      webClient: { errors: 0, accessible: webClientAccessible }
    };

    if (wundrAccessible) {
      const wundrErrors = await wundrUtils.captureJSErrors();
      await wundrPage.goto(TEST_CONFIG.dashboards.wundr.baseURL);
      await wundrPage.waitForTimeout(3000);
      results.wundr.errors = wundrErrors.length;
    }

    if (webClientAccessible) {
      const webClientErrors = await webClientUtils.captureJSErrors();
      await webClientPage.goto(TEST_CONFIG.dashboards.webClient.baseURL);
      await webClientPage.waitForTimeout(3000);
      results.webClient.errors = webClientErrors.length;
    }

    console.log('Error Comparison:', results);

    // Both dashboards should have minimal errors
    if (results.wundr.accessible) {
      expect(results.wundr.errors).toBeLessThan(5);
    }
    if (results.webClient.accessible) {
      expect(results.webClient.errors).toBeLessThan(5);
    }
  });

  test('should validate shared dependencies and consistency', async () => {
    // This test validates that both dashboards use consistent styling and components
    
    const wundrUtils = new TestUtilities(wundrPage);
    const webClientUtils = new TestUtilities(webClientPage);
    
    const wundrAccessible = await wundrUtils.checkUrlAccessibility(TEST_CONFIG.dashboards.wundr.baseURL);
    const webClientAccessible = await webClientUtils.checkUrlAccessibility(TEST_CONFIG.dashboards.webClient.baseURL);

    if (!wundrAccessible || !webClientAccessible) {
      test.skip();
      return;
    }

    await wundrPage.goto(TEST_CONFIG.dashboards.wundr.baseURL);
    await webClientPage.goto(TEST_CONFIG.dashboards.webClient.baseURL);

    // Check for common styling frameworks (Tailwind classes)
    const wundrTailwind = await wundrPage.locator('[class*="tw-"], [class*="flex"], [class*="grid"]').count();
    const webClientTailwind = await webClientPage.locator('[class*="tw-"], [class*="flex"], [class*="grid"]').count();

    // Check for common UI library components (Radix, shadcn/ui)
    const wundrRadix = await wundrPage.locator('[data-radix-component], [data-state]').count();
    const webClientRadix = await webClientPage.locator('[data-radix-component], [data-state]').count();

    console.log('Styling Consistency Check:', {
      wundr: { tailwind: wundrTailwind, radix: wundrRadix },
      webClient: { tailwind: webClientTailwind, radix: webClientRadix }
    });

    // Both should use similar component libraries
    expect(wundrTailwind).toBeGreaterThan(0);
    expect(webClientTailwind).toBeGreaterThan(0);
  });
});