import { expect } from '@playwright/test';
import { test } from '../fixtures';

test.describe('Performance & Load Testing E2E Tests', () => {
  test.beforeEach(async ({ mockDataHelper, websocketHelper }) => {
    await mockDataHelper.setupMockApiResponses();
    await websocketHelper.setupWebSocketMock();
    await mockDataHelper.injectTestDataAttributes();
  });

  test('should handle page load performance under various conditions', async ({ 
    dashboardPage, 
    performanceHelper,
    page 
  }) => {
    await performanceHelper.startPerformanceMonitoring();

    // Test 1: Normal conditions
    const normalLoadMetrics = await performanceHelper.measurePageLoadPerformance();
    
    // Performance thresholds
    expect(normalLoadMetrics.totalLoadTime).toBeLessThan(5000); // 5 seconds
    expect(normalLoadMetrics.domContentLoaded).toBeLessThan(2000); // 2 seconds
    expect(normalLoadMetrics.firstContentfulPaint).toBeLessThan(1500); // 1.5 seconds

    // Test 2: Slow network conditions
    const cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send('Network.enable');
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 200,
      downloadThroughput: 500 * 1024, // 500kb/s
      uploadThroughput: 500 * 1024
    });

    const slowNetworkMetrics = await performanceHelper.measurePageLoadPerformance();
    
    // Should still load within reasonable time on slow network
    expect(slowNetworkMetrics.totalLoadTime).toBeLessThan(15000); // 15 seconds

    // Test 3: CPU throttling
    await cdpSession.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    
    const throttledCpuMetrics = await performanceHelper.measurePageLoadPerformance();
    
    // Should handle CPU throttling gracefully
    expect(throttledCpuMetrics.totalLoadTime).toBeLessThan(10000); // 10 seconds

    await cdpSession.detach();
    await performanceHelper.stopPerformanceMonitoring();
  });

  test('should maintain performance with high-frequency WebSocket updates', async ({ 
    dashboardPage, 
    websocketHelper, 
    performanceHelper,
    page 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();
    
    const wsPerformanceMetrics = await performanceHelper.measureWebSocketPerformance();
    
    // Test high-frequency updates
    const updateInterval = 100; // 100ms
    const updateCount = 100;
    
    const startTime = Date.now();
    
    for (let i = 0; i < updateCount; i++) {
      await websocketHelper.sendRealtimeMetrics();
      await page.waitForTimeout(updateInterval);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Should handle updates efficiently
    expect(totalTime).toBeLessThan((updateCount * updateInterval) + 5000); // 5s buffer
    
    // Memory shouldn't increase dramatically
    const memoryAfterUpdates = await performanceHelper.measureMemoryUsage();
    expect(memoryAfterUpdates.memoryUsagePercentage).toBeLessThan(70);
    
    // UI should still be responsive
    await expect(dashboardPage.metricsGrid).toBeVisible();
    await dashboardPage.performQuickAction('refresh');
  });

  test('should handle large dataset rendering performance', async ({ 
    dashboardPage, 
    performanceHelper,
    page 
  }) => {
    // Mock large dataset
    await page.route('**/api/**', route => {
      const largeDataset = {
        success: true,
        data: {
          metrics: Array.from({ length: 1000 }, (_, i) => ({
            id: `metric_${i}`,
            name: `Metric ${i}`,
            value: Math.random() * 100,
            timestamp: new Date(Date.now() - i * 60000).toISOString()
          })),
          trends: Array.from({ length: 365 }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
            value: Math.random() * 1000,
            tests: Math.floor(Math.random() * 500),
            coverage: Math.random() * 100
          })),
          dependencies: Array.from({ length: 500 }, (_, i) => ({
            name: `package-${i}`,
            version: `1.${i}.0`,
            size: Math.floor(Math.random() * 1000000)
          }))
        }
      };
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largeDataset)
      });
    });

    await performanceHelper.startPerformanceMonitoring();
    
    const startTime = Date.now();
    await dashboardPage.goto();
    await dashboardPage.assertChartVisible();
    const loadTime = Date.now() - startTime;

    // Should handle large datasets within reasonable time
    expect(loadTime).toBeLessThan(8000); // 8 seconds

    // Test scrolling performance with large lists
    await dashboardPage.navigateToSection('dependencies');
    
    const dependencyList = page.locator('[data-testid="dependency-list"], .dependency-container');
    if (await dependencyList.isVisible()) {
      // Measure FPS during scrolling
      const scrollStartTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        await dependencyList.evaluate(el => el.scrollBy(0, 200));
        await page.waitForTimeout(100);
      }
      
      const scrollEndTime = Date.now();
      const scrollTime = scrollEndTime - scrollStartTime;
      
      // Scrolling should be smooth (less than 2s for 10 scroll operations)
      expect(scrollTime).toBeLessThan(2000);
    }

    const memory = await performanceHelper.measureMemoryUsage();
    expect(memory.used / 1024 / 1024).toBeLessThan(200); // Less than 200MB

    await performanceHelper.stopPerformanceMonitoring();
  });

  test('should handle concurrent user interactions efficiently', async ({ 
    dashboardPage, 
    performanceHelper,
    websocketHelper,
    page 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();
    
    await performanceHelper.startPerformanceMonitoring();
    
    // Simulate concurrent actions
    const concurrentActions = [];
    
    // Action 1: Continuous WebSocket updates
    concurrentActions.push(async () => {
      for (let i = 0; i < 20; i++) {
        await websocketHelper.sendRealtimeMetrics();
        await page.waitForTimeout(200);
      }
    });
    
    // Action 2: Navigation between sections
    concurrentActions.push(async () => {
      const sections = ['analytics', 'performance', 'dependencies', 'overview'];
      for (const section of sections) {
        await dashboardPage.navigateToSection(section);
        await page.waitForTimeout(500);
      }
    });
    
    // Action 3: Theme switching
    concurrentActions.push(async () => {
      for (let i = 0; i < 5; i++) {
        await dashboardPage.toggleTheme();
        await page.waitForTimeout(1000);
      }
    });
    
    // Action 4: Chart interactions
    concurrentActions.push(async () => {
      for (let i = 0; i < 10; i++) {
        const chart = dashboardPage.overviewChart;
        if (await chart.isVisible()) {
          await chart.hover({ position: { x: 100 + i * 20, y: 200 } });
          await page.waitForTimeout(300);
        }
      }
    });

    const startTime = Date.now();
    
    // Run all actions concurrently
    await Promise.all(concurrentActions.map(action => action()));
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should complete within reasonable time
    expect(totalTime).toBeLessThan(15000); // 15 seconds

    // Check final state
    await expect(dashboardPage.metricsGrid).toBeVisible();
    await dashboardPage.assertChartVisible();

    const finalMemory = await performanceHelper.measureMemoryUsage();
    expect(finalMemory.memoryUsagePercentage).toBeLessThan(80);

    await performanceHelper.stopPerformanceMonitoring();
  });

  test('should handle memory leaks and cleanup properly', async ({ 
    dashboardPage, 
    performanceHelper,
    websocketHelper,
    page 
  }) => {
    await performanceHelper.startPerformanceMonitoring();
    
    // Get baseline memory
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();
    const baselineMemory = await performanceHelper.measureMemoryUsage();

    // Perform memory-intensive operations
    for (let cycle = 0; cycle < 5; cycle++) {
      // Navigate through all sections
      const sections = ['analytics', 'performance', 'dependencies', 'overview'];
      for (const section of sections) {
        await dashboardPage.navigateToSection(section);
        
        // Send WebSocket data
        await websocketHelper.sendRealtimeMetrics();
        await websocketHelper.sendBuildEvent('completed', 100);
        
        // Toggle theme
        await dashboardPage.toggleTheme();
        
        // Interact with charts
        const chart = dashboardPage.overviewChart;
        if (await chart.isVisible()) {
          await chart.hover();
        }
        
        await page.waitForTimeout(500);
      }
    }

    // Force garbage collection if available
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });

    await page.waitForTimeout(2000);
    
    const finalMemory = await performanceHelper.measureMemoryUsage();
    const memoryIncrease = finalMemory.used - baselineMemory.used;
    const memoryIncreasePercent = (memoryIncrease / baselineMemory.used) * 100;

    // Memory increase should be reasonable (less than 100% increase)
    expect(memoryIncreasePercent).toBeLessThan(100);
    expect(finalMemory.memoryUsagePercentage).toBeLessThan(85);

    await performanceHelper.stopPerformanceMonitoring();
  });

  test('should maintain performance during data export operations', async ({ 
    dashboardPage, 
    performanceHelper,
    page 
  }) => {
    await dashboardPage.goto();
    await performanceHelper.startPerformanceMonitoring();

    // Test CSV export performance
    const exportButton = page.locator('[data-testid="export-data"], button:has-text("Export")');
    if (await exportButton.isVisible()) {
      const exportStartTime = Date.now();
      
      // Start export
      await exportButton.click();
      
      const csvExportOption = page.locator('text="CSV", [data-export="csv"]');
      if (await csvExportOption.isVisible()) {
        const downloadPromise = page.waitForEvent('download');
        await csvExportOption.click();
        
        const download = await downloadPromise;
        const exportEndTime = Date.now();
        const exportTime = exportEndTime - exportStartTime;
        
        // Export should complete quickly
        expect(exportTime).toBeLessThan(5000); // 5 seconds
        
        // Verify file was created
        expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/i);
      }
    }

    // Test chart image export
    const chartExportButton = page.locator('[data-testid="export-chart"]');
    if (await chartExportButton.isVisible()) {
      const chartExportStartTime = Date.now();
      
      const downloadPromise = page.waitForEvent('download');
      await chartExportButton.click();
      
      const download = await downloadPromise;
      const chartExportEndTime = Date.now();
      const chartExportTime = chartExportEndTime - chartExportStartTime;
      
      // Chart export should be fast
      expect(chartExportTime).toBeLessThan(3000); // 3 seconds
      expect(download.suggestedFilename()).toMatch(/\.(png|jpg|svg)$/i);
    }

    // UI should remain responsive during export
    await expect(dashboardPage.metricsGrid).toBeVisible();
    await dashboardPage.performQuickAction('refresh');

    await performanceHelper.stopPerformanceMonitoring();
  });

  test('should handle performance under stress conditions', async ({ 
    dashboardPage, 
    performanceHelper,
    websocketHelper,
    page 
  }) => {
    // Create stress conditions
    const cdpSession = await page.context().newCDPSession(page);
    
    // Throttle CPU and network
    await cdpSession.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdpSession.send('Network.enable');
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 300,
      downloadThroughput: 256 * 1024, // 256kb/s (slow 3G)
      uploadThroughput: 256 * 1024
    });

    await performanceHelper.startPerformanceMonitoring();
    
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();

    // Stress test: Rapid interactions under poor conditions
    const stressActions = [];
    
    // Rapid WebSocket messages
    stressActions.push(async () => {
      for (let i = 0; i < 50; i++) {
        await websocketHelper.sendRealtimeMetrics();
        await page.waitForTimeout(50); // Very frequent updates
      }
    });
    
    // Rapid navigation
    stressActions.push(async () => {
      const sections = ['analytics', 'performance', 'dependencies'];
      for (let i = 0; i < 10; i++) {
        const section = sections[i % sections.length];
        await dashboardPage.navigateToSection(section);
        await page.waitForTimeout(200);
      }
    });

    const stressStartTime = Date.now();
    await Promise.all(stressActions.map(action => action()));
    const stressEndTime = Date.now();
    const stressTestTime = stressEndTime - stressStartTime;

    // Should complete within reasonable time even under stress
    expect(stressTestTime).toBeLessThan(30000); // 30 seconds

    // App should still be functional
    await expect(dashboardPage.metricsGrid).toBeVisible();
    
    // No JavaScript errors should occur
    const jsErrors: string[] = [];
    page.on('pageerror', error => jsErrors.push(error.message));
    
    await page.waitForTimeout(2000);
    expect(jsErrors.length).toBe(0);

    await cdpSession.detach();
    await performanceHelper.stopPerformanceMonitoring();
  });

  test('should maintain chart performance during rapid data updates', async ({ 
    dashboardPage, 
    websocketHelper,
    performanceHelper,
    page 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();
    await dashboardPage.assertChartVisible();

    await performanceHelper.startPerformanceMonitoring();

    const chartPerformanceStartTime = Date.now();
    
    // Send rapid chart data updates
    for (let i = 0; i < 100; i++) {
      await websocketHelper.sendMockMessage({
        type: 'chart_update',
        data: {
          trends: Array.from({ length: 50 }, (_, j) => ({
            date: new Date(Date.now() - j * 3600000).toISOString(),
            value: Math.random() * 1000,
            timestamp: new Date().toISOString()
          }))
        }
      });
      
      await page.waitForTimeout(50); // 20 FPS update rate
    }

    const chartPerformanceEndTime = Date.now();
    const chartUpdateTime = chartPerformanceEndTime - chartPerformanceStartTime;

    // Chart updates should complete in reasonable time
    expect(chartUpdateTime).toBeLessThan(10000); // 10 seconds

    // Charts should still be responsive
    const chart = dashboardPage.overviewChart;
    await chart.hover({ position: { x: 200, y: 150 } });
    
    // Tooltip should appear quickly
    const tooltip = page.locator('.recharts-tooltip, [data-testid="chart-tooltip"]');
    await expect(tooltip).toBeVisible({ timeout: 2000 });

    // Measure final chart render performance
    const finalChartMetrics = await performanceHelper.measureChartRenderPerformance();
    expect(finalChartMetrics.fps).toBeGreaterThan(15); // At least 15 FPS

    await performanceHelper.stopPerformanceMonitoring();
  });

  test('should generate comprehensive performance report', async ({ 
    dashboardPage, 
    performanceHelper,
    websocketHelper 
  }) => {
    // Run comprehensive performance benchmark
    const benchmark = await performanceHelper.runPerformanceBenchmark();
    
    // Generate performance report
    const report = await performanceHelper.generatePerformanceReport(
      'Dashboard E2E Performance Test',
      benchmark
    );

    // Validate report structure
    expect(report.testName).toBe('Dashboard E2E Performance Test');
    expect(report.timestamp).toBeTruthy();
    expect(report.metrics).toBeTruthy();
    expect(report.summary.passed).toBeDefined();

    // Check key performance indicators
    if (benchmark.pageLoad) {
      expect(benchmark.pageLoad.totalLoadTime).toBeLessThan(5000);
    }

    if (benchmark.memory) {
      expect(benchmark.memory.memoryUsagePercentage).toBeLessThan(80);
    }

    if (benchmark.websocket) {
      expect(benchmark.websocket.averageLatency).toBeLessThan(500);
    }

    // Log performance metrics for monitoring
    console.log('Performance Report:', JSON.stringify(report, null, 2));

    // Assert overall performance is acceptable
    expect(report.summary.passed).toBe(true);
    expect(report.summary.issues.length).toBeLessThan(3); // No more than 2 minor issues
  });
});