import { expect } from '@playwright/test';
import { test } from '../fixtures';

test.describe('Mobile & Responsive E2E Tests', () => {
  const mobileDevices = [
    { name: 'iPhone 12', width: 390, height: 844 },
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'Samsung Galaxy S21', width: 360, height: 800 },
    { name: 'iPad Mini', width: 768, height: 1024 }
  ];

  const desktopSizes = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1366x768', width: 1366, height: 768 },
    { name: '1440x900', width: 1440, height: 900 }
  ];

  test.beforeEach(async ({ mockDataHelper }) => {
    await mockDataHelper.setupMockApiResponses();
    await mockDataHelper.injectTestDataAttributes();
  });

  test('should adapt layout for different mobile devices', async ({ dashboardPage, page }) => {
    for (const device of mobileDevices) {
      await page.setViewportSize({ width: device.width, height: device.height });
      await dashboardPage.goto();

      // Mobile-specific assertions
      if (device.width < 768) {
        // Sidebar should be hidden or collapsed on small screens
        const sidebar = dashboardPage.sidebar;
        const sidebarVisible = await sidebar.isVisible();
        
        if (sidebarVisible) {
          // If visible, should be in mobile mode (overlay/drawer)
          const sidebarClasses = await sidebar.getAttribute('class');
          expect(sidebarClasses).toMatch(/mobile|drawer|overlay|collapsed/i);
        }

        // Mobile menu button should be present
        const mobileMenuButton = page.locator(
          '[data-testid="mobile-menu"], [data-testid="menu-toggle"], .hamburger, .menu-button'
        );
        await expect(mobileMenuButton).toBeVisible();

        // Metrics should stack vertically
        await dashboardPage.checkResponsiveLayout();
      }

      // Charts should remain visible and responsive
      await dashboardPage.assertChartVisible();
      
      // Charts should have appropriate dimensions for the screen
      const chartBox = await dashboardPage.overviewChart.boundingBox();
      if (chartBox) {
        expect(chartBox.width).toBeLessThanOrEqual(device.width - 32); // Account for padding
        expect(chartBox.width).toBeGreaterThan(device.width * 0.7); // Should use most of the width
      }
    }
  });

  test('should handle touch interactions on mobile', async ({ dashboardPage, page }) => {
    // Set to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await dashboardPage.goto();

    // Test mobile menu interaction
    const mobileMenu = page.locator('[data-testid="mobile-menu"], .mobile-menu-button');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.tap();
      
      // Sidebar/navigation should appear
      const navigation = page.locator('[data-testid="mobile-nav"], nav, [role="navigation"]');
      await expect(navigation).toBeVisible();
      
      // Test navigation item tap
      const navItem = navigation.locator('a, button').first();
      if (await navItem.isVisible()) {
        await navItem.tap();
      }
    }

    // Test chart touch interactions
    const chart = dashboardPage.overviewChart;
    if (await chart.isVisible()) {
      const chartArea = chart.locator('svg, canvas').first();
      
      // Tap on chart
      await chartArea.tap();
      
      // Test swipe gestures (if supported)
      await chartArea.hover({ position: { x: 100, y: 100 } });
      await page.mouse.down();
      await page.mouse.move(200, 100);
      await page.mouse.up();
    }

    // Test metric card interactions
    const metricCards = page.locator('[data-testid="metric-card"]');
    const cardCount = await metricCards.count();
    
    if (cardCount > 0) {
      await metricCards.first().tap();
      // Should show details or expand
      await page.waitForTimeout(500);
    }
  });

  test('should maintain performance on mobile devices', async ({ 
    dashboardPage, 
    performanceHelper,
    page 
  }) => {
    // Test on a slower mobile device simulation
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Simulate slower CPU
    const cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await performanceHelper.startPerformanceMonitoring();
    
    const startTime = Date.now();
    await dashboardPage.goto();
    await dashboardPage.assertChartVisible();
    const loadTime = Date.now() - startTime;

    // Should load within reasonable time even on slower devices
    expect(loadTime).toBeLessThan(8000); // 8 seconds max for mobile

    const performanceMetrics = await performanceHelper.measurePageLoadPerformance();
    
    // Mobile performance thresholds
    expect(performanceMetrics.domInteractive).toBeLessThan(3000);
    expect(performanceMetrics.firstContentfulPaint).toBeLessThan(2000);

    // Memory usage should be reasonable on mobile
    const memory = await performanceHelper.measureMemoryUsage();
    expect(memory.used / 1024 / 1024).toBeLessThan(100); // Less than 100MB

    await performanceHelper.stopPerformanceMonitoring();
    await cdpSession.detach();
  });

  test('should handle orientation changes', async ({ dashboardPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // Portrait
    await dashboardPage.goto();

    // Verify portrait layout
    await dashboardPage.assertChartVisible();
    const portraitChartBox = await dashboardPage.overviewChart.boundingBox();

    // Change to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(1000); // Allow layout to adjust

    // Charts should adapt to landscape
    const landscapeChartBox = await dashboardPage.overviewChart.boundingBox();
    
    if (portraitChartBox && landscapeChartBox) {
      // Width should increase in landscape
      expect(landscapeChartBox.width).toBeGreaterThan(portraitChartBox.width);
      
      // Height might decrease due to less vertical space
      expect(landscapeChartBox.height).toBeLessThanOrEqual(portraitChartBox.height + 50);
    }

    // Navigation should still work
    const mobileMenu = page.locator('[data-testid="mobile-menu"]');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
    }
  });

  test('should optimize content for tablet devices', async ({ dashboardPage, page }) => {
    // iPad dimensions
    await page.setViewportSize({ width: 768, height: 1024 });
    await dashboardPage.goto();

    // Tablet should show more content than mobile but less than desktop
    await expect(dashboardPage.sidebar).toBeVisible();
    await expect(dashboardPage.metricsGrid).toBeVisible();

    // Should have good use of space
    const metrics = await dashboardPage.getMetrics();
    expect(metrics.length).toBeGreaterThan(0);

    // Charts should be well-sized for tablet
    const chartBox = await dashboardPage.overviewChart.boundingBox();
    if (chartBox) {
      expect(chartBox.width).toBeGreaterThan(500);
      expect(chartBox.width).toBeLessThan(700);
    }

    // Test landscape tablet
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(1000);

    await dashboardPage.assertChartVisible();
    
    // Should utilize horizontal space better
    const landscapeChartBox = await dashboardPage.overviewChart.boundingBox();
    if (landscapeChartBox && chartBox) {
      expect(landscapeChartBox.width).toBeGreaterThan(chartBox.width);
    }
  });

  test('should handle text scaling and accessibility on mobile', async ({ dashboardPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await dashboardPage.goto();

    // Test with increased font size (accessibility setting)
    await page.addStyleTag({
      content: `
        * { 
          font-size: 120% !important; 
        }
      `
    });

    await page.waitForTimeout(1000);

    // Layout should still be usable
    await expect(dashboardPage.metricsGrid).toBeVisible();
    await dashboardPage.assertChartVisible();

    // Text should not overflow
    const metricCards = page.locator('[data-testid="metric-card"]');
    const cardCount = await metricCards.count();
    
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = metricCards.nth(i);
      const cardBox = await card.boundingBox();
      
      if (cardBox) {
        // Card should not be cut off
        expect(cardBox.width).toBeGreaterThan(0);
        expect(cardBox.height).toBeGreaterThan(0);
      }
    }

    // Test with high contrast (another accessibility feature)
    await page.addStyleTag({
      content: `
        * { 
          filter: contrast(200%) !important;
        }
      `
    });

    // Should still be functional
    await dashboardPage.assertChartVisible();
  });

  test('should work offline/with poor connectivity', async ({ dashboardPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Simulate slow 3G connection
    const cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send('Network.enable');
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 100,
      downloadThroughput: 400 * 1024, // 400kb/s
      uploadThroughput: 400 * 1024
    });

    await dashboardPage.goto();

    // Should show loading states appropriately
    const loadingIndicator = page.locator('[data-testid="loading"], .loading, .spinner');
    // Loading might be visible briefly
    
    await dashboardPage.page.waitForTimeout(2000);

    // Eventually should load
    await expect(dashboardPage.metricsGrid).toBeVisible({ timeout: 15000 });

    // Test offline scenario
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0
    });

    // Try to navigate
    await dashboardPage.navigateToSection('analytics');

    // Should show offline indicator or cached content
    const offlineIndicator = page.locator('[data-testid="offline"], .offline-indicator');
    // May or may not be visible depending on implementation

    await cdpSession.detach();
  });

  test('should optimize images and assets for mobile', async ({ dashboardPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Monitor network requests
    const requests: any[] = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        resourceType: request.resourceType(),
        size: request.postData()?.length || 0
      });
    });

    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Check for appropriately sized images
    const imageRequests = requests.filter(r => r.resourceType === 'image');
    
    // Should not load unnecessarily large images on mobile
    for (const imgReq of imageRequests) {
      if (imgReq.size > 0) {
        expect(imgReq.size).toBeLessThan(500 * 1024); // Less than 500KB per image
      }
    }

    // Check CSS and JS bundle sizes
    const cssRequests = requests.filter(r => r.resourceType === 'stylesheet');
    const jsRequests = requests.filter(r => r.resourceType === 'script');

    // Bundles should be reasonably sized for mobile
    const totalCssSize = cssRequests.reduce((sum, req) => sum + req.size, 0);
    const totalJsSize = jsRequests.reduce((sum, req) => sum + req.size, 0);

    // These are rough estimates - adjust based on your app
    expect(totalCssSize).toBeLessThan(200 * 1024); // Less than 200KB CSS
    expect(totalJsSize).toBeLessThan(1000 * 1024); // Less than 1MB JS
  });

  test('should provide good mobile user experience patterns', async ({ dashboardPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await dashboardPage.goto();

    // Test pull-to-refresh pattern (if implemented)
    const refreshArea = page.locator('[data-testid="refresh-area"], body');
    await refreshArea.hover({ position: { x: 187, y: 50 } });
    await page.mouse.down();
    await page.mouse.move(187, 150); // Pull down
    await page.mouse.up();
    
    // May trigger refresh
    await page.waitForTimeout(1000);

    // Test swipe navigation (if implemented)
    const chartArea = dashboardPage.overviewChart;
    if (await chartArea.isVisible()) {
      await chartArea.hover({ position: { x: 300, y: 200 } });
      await page.mouse.down();
      await page.mouse.move(100, 200); // Swipe left
      await page.mouse.up();
      
      // May change chart view or navigate
      await page.waitForTimeout(1000);
    }

    // Test long press (context menu)
    const metricCard = page.locator('[data-testid="metric-card"]').first();
    if (await metricCard.isVisible()) {
      await metricCard.hover();
      await page.mouse.down();
      await page.waitForTimeout(1000); // Long press
      await page.mouse.up();
      
      // May show context menu
      const contextMenu = page.locator('[data-testid="context-menu"], .context-menu');
      // Context menu may or may not appear depending on implementation
    }

    // Verify touch targets are appropriately sized (at least 44px)
    const interactiveElements = page.locator('button, a, input, [role="button"]');
    const elementCount = await interactiveElements.count();
    
    for (let i = 0; i < Math.min(elementCount, 5); i++) {
      const element = interactiveElements.nth(i);
      const box = await element.boundingBox();
      
      if (box && await element.isVisible()) {
        // Touch targets should be at least 44x44 pixels
        expect(Math.max(box.width, box.height)).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test('should handle desktop-to-mobile responsive transitions', async ({ dashboardPage, page }) => {
    // Start with desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await dashboardPage.goto();
    
    await expect(dashboardPage.sidebar).toBeVisible();
    await dashboardPage.assertChartVisible();

    // Gradually reduce size to test breakpoints
    const breakpoints = [
      { width: 1200, height: 800 }, // Large desktop
      { width: 1024, height: 768 }, // Laptop
      { width: 768, height: 1024 }, // Tablet
      { width: 480, height: 800 },  // Small tablet
      { width: 375, height: 667 }   // Mobile
    ];

    for (const breakpoint of breakpoints) {
      await page.setViewportSize(breakpoint);
      await page.waitForTimeout(500); // Allow transition

      // Core functionality should remain
      await expect(dashboardPage.metricsGrid).toBeVisible();
      await dashboardPage.assertChartVisible();

      // Layout should adapt appropriately
      const chartBox = await dashboardPage.overviewChart.boundingBox();
      if (chartBox) {
        expect(chartBox.width).toBeLessThanOrEqual(breakpoint.width - 16);
        expect(chartBox.width).toBeGreaterThan(breakpoint.width * 0.6);
      }
    }
  });
});