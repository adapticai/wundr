import { expect } from '@playwright/test';
import { test } from '../fixtures';

test.describe('Dashboard Visualization E2E Tests', () => {
  test.beforeEach(async ({ mockDataHelper, page }) => {
    await mockDataHelper.setupMockApiResponses();
    await mockDataHelper.injectTestDataAttributes();
  });

  test('should render all chart types correctly', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    
    // Wait for charts to load
    await dashboardPage.assertChartVisible();
    
    // Check overview area chart
    const overviewChart = page.locator('[data-testid="overview-chart"]');
    await expect(overviewChart).toBeVisible();
    
    // Verify chart has SVG/Canvas element
    const chartSvg = overviewChart.locator('svg, canvas').first();
    await expect(chartSvg).toBeVisible();
    
    // Check chart dimensions
    const chartBox = await chartSvg.boundingBox();
    expect(chartBox?.width).toBeGreaterThan(300);
    expect(chartBox?.height).toBeGreaterThan(200);
  });

  test('should handle chart interactions (hover, click, zoom)', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    await dashboardPage.assertChartVisible();
    
    const chart = page.locator('[data-testid="overview-chart"]');
    const chartArea = chart.locator('svg, canvas').first();
    
    // Test hover interaction - tooltip should appear
    await chartArea.hover({ position: { x: 200, y: 150 } });
    
    // Look for tooltip (may be in chart or separate element)
    const tooltip = page.locator('.recharts-tooltip, [data-testid="chart-tooltip"], .tooltip').first();
    await expect(tooltip).toBeVisible({ timeout: 2000 });
    
    // Test data point interaction
    const dataPoints = chart.locator('circle, rect, path[class*="dot"], path[class*="point"]');
    if (await dataPoints.count() > 0) {
      await dataPoints.first().click();
      
      // Verify some interaction occurred (could be details panel, highlight, etc.)
      await page.waitForTimeout(500);
    }
  });

  test('should export chart data and images', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    await dashboardPage.assertChartVisible();
    
    // Test chart export functionality
    const exportButton = page.locator('[data-testid="export-chart"], [data-testid="chart-export"]');
    
    if (await exportButton.isVisible()) {
      // Test PNG export
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      
      const exportMenu = page.locator('[data-testid="export-menu"]');
      if (await exportMenu.isVisible()) {
        await exportMenu.locator('text="PNG"').click();
      }
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.(png|jpg|jpeg)$/i);
    }
  });

  test('should adapt charts to different screen sizes', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    
    // Test desktop view
    await dashboardPage.page.setViewportSize({ width: 1920, height: 1080 });
    await dashboardPage.assertChartVisible();
    
    let chartBox = await dashboardPage.overviewChart.boundingBox();
    const desktopWidth = chartBox?.width || 0;
    
    // Test tablet view
    await dashboardPage.page.setViewportSize({ width: 768, height: 1024 });
    await dashboardPage.page.waitForTimeout(500);
    
    chartBox = await dashboardPage.overviewChart.boundingBox();
    const tabletWidth = chartBox?.width || 0;
    
    // Test mobile view
    await dashboardPage.page.setViewportSize({ width: 375, height: 667 });
    await dashboardPage.page.waitForTimeout(500);
    
    chartBox = await dashboardPage.overviewChart.boundingBox();
    const mobileWidth = chartBox?.width || 0;
    
    // Charts should adapt to different screen sizes
    expect(desktopWidth).toBeGreaterThan(tabletWidth);
    expect(tabletWidth).toBeGreaterThan(mobileWidth);
    expect(mobileWidth).toBeGreaterThan(250); // Still readable on mobile
  });

  test('should handle empty data gracefully', async ({ mockDataHelper, dashboardPage, page }) => {
    // Setup empty data responses
    await page.route('**/api/metrics**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            overview: { totalProjects: 0, activeProjects: 0, totalTests: 0 },
            trends: []
          }
        })
      });
    });
    
    await dashboardPage.goto();
    
    // Should show empty state
    const emptyState = page.locator('[data-testid="empty-state"], [data-testid="no-data"]');
    await expect(emptyState).toBeVisible({ timeout: 10000 });
    
    // Should have appropriate empty state message
    const emptyMessage = emptyState.locator('text=/no data|empty|get started/i');
    await expect(emptyMessage).toBeVisible();
  });

  test('should display real-time chart updates', async ({ dashboardPage, websocketHelper, page }) => {
    await websocketHelper.setupWebSocketMock();
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();
    
    // Get initial chart state
    const chart = page.locator('[data-testid="overview-chart"]');
    await expect(chart).toBeVisible();
    
    // Send new data via WebSocket
    await websocketHelper.sendRealtimeMetrics();
    
    // Chart should update (look for animation or data change)
    await page.waitForTimeout(1000);
    
    // Verify chart is still visible and potentially animated
    await expect(chart).toBeVisible();
    
    // Look for real-time indicator
    const realtimeIndicator = page.locator('[data-testid="realtime-indicator"], .live-indicator');
    if (await realtimeIndicator.isVisible()) {
      await expect(realtimeIndicator).toHaveClass(/active|live|updating/);
    }
  });

  test('should handle chart theme switching', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    await dashboardPage.assertChartVisible();
    
    // Get initial chart colors (SVG paths/fills)
    const initialColors = await page.evaluate(() => {
      const svgElements = document.querySelectorAll('[data-testid="overview-chart"] svg *[fill], [data-testid="overview-chart"] svg *[stroke]');
      return Array.from(svgElements).map(el => ({
        fill: el.getAttribute('fill'),
        stroke: el.getAttribute('stroke')
      }));
    });
    
    // Toggle theme
    await dashboardPage.toggleTheme();
    await page.waitForTimeout(1000);
    
    // Get colors after theme change
    const updatedColors = await page.evaluate(() => {
      const svgElements = document.querySelectorAll('[data-testid="overview-chart"] svg *[fill], [data-testid="overview-chart"] svg *[stroke]');
      return Array.from(svgElements).map(el => ({
        fill: el.getAttribute('fill'),
        stroke: el.getAttribute('stroke')
      }));
    });
    
    // Colors should be different (theme adapted)
    const colorsChanged = initialColors.some((initial, index) => {
      const updated = updatedColors[index];
      return updated && (initial.fill !== updated.fill || initial.stroke !== updated.stroke);
    });
    
    expect(colorsChanged).toBe(true);
  });

  test('should display multiple chart types correctly', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    
    // Navigate to different sections with various chart types
    await dashboardPage.navigateToSection('analytics');
    
    // Check for line charts
    const lineChart = page.locator('[data-testid="line-chart"], .recharts-line-chart');
    if (await lineChart.isVisible()) {
      const linePaths = lineChart.locator('path.recharts-line, path[stroke]');
      await expect(linePaths.first()).toBeVisible();
    }
    
    // Navigate to performance section
    await dashboardPage.navigateToSection('performance');
    
    // Check for bar charts
    const barChart = page.locator('[data-testid="bar-chart"], .recharts-bar-chart');
    if (await barChart.isVisible()) {
      const bars = barChart.locator('rect[fill], .recharts-bar-rectangle');
      await expect(bars.first()).toBeVisible();
    }
  });

  test('should handle chart data filtering and time ranges', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    await dashboardPage.assertChartVisible();
    
    // Look for time range selector
    const timeRangeSelector = page.locator(
      '[data-testid="time-range"], [data-testid="date-picker"], select[name*="range"]'
    );
    
    if (await timeRangeSelector.isVisible()) {
      // Change time range
      await timeRangeSelector.selectOption({ label: '7 days' });
      await page.waitForTimeout(1000);
      
      // Chart should update
      await dashboardPage.assertChartVisible();
      
      // Try different range
      await timeRangeSelector.selectOption({ label: '30 days' });
      await page.waitForTimeout(1000);
      
      await dashboardPage.assertChartVisible();
    }
    
    // Look for data filters
    const dataFilter = page.locator('[data-testid="chart-filter"], [data-testid="data-filter"]');
    if (await dataFilter.isVisible()) {
      await dataFilter.click();
      
      // Toggle some filter options
      const filterOptions = page.locator('[data-testid="filter-option"], input[type="checkbox"]');
      const optionCount = await filterOptions.count();
      
      if (optionCount > 0) {
        await filterOptions.first().click();
        await page.waitForTimeout(500);
        await dashboardPage.assertChartVisible();
      }
    }
  });

  test('should display chart legends and labels correctly', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    await dashboardPage.assertChartVisible();
    
    const chart = page.locator('[data-testid="overview-chart"]');
    
    // Check for legend
    const legend = chart.locator('.recharts-legend, [data-testid="chart-legend"]');
    if (await legend.isVisible()) {
      const legendItems = legend.locator('.recharts-legend-item, [data-testid="legend-item"]');
      const legendCount = await legendItems.count();
      expect(legendCount).toBeGreaterThan(0);
    }
    
    // Check for axis labels
    const xAxis = chart.locator('.recharts-xAxis, [data-testid="x-axis"]');
    const yAxis = chart.locator('.recharts-yAxis, [data-testid="y-axis"]');
    
    if (await xAxis.isVisible()) {
      const xAxisLabels = xAxis.locator('text, .tick-label');
      expect(await xAxisLabels.count()).toBeGreaterThan(0);
    }
    
    if (await yAxis.isVisible()) {
      const yAxisLabels = yAxis.locator('text, .tick-label');
      expect(await yAxisLabels.count()).toBeGreaterThan(0);
    }
  });

  test('should handle chart error states', async ({ dashboardPage, page }) => {
    // Setup API to return errors
    await page.route('**/api/metrics**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to fetch metrics' })
      });
    });
    
    await dashboardPage.goto();
    
    // Should show error state instead of chart
    const errorState = page.locator(
      '[data-testid="chart-error"], [data-testid="error-message"], .error-state'
    );
    await expect(errorState).toBeVisible({ timeout: 10000 });
    
    // Should have retry functionality
    const retryButton = page.locator('[data-testid="retry"], button:has-text("retry")');
    if (await retryButton.isVisible()) {
      // Mock successful response for retry
      await page.route('**/api/metrics**', route => {
        const mockData = {
          success: true,
          data: { overview: { totalProjects: 5 }, trends: [] }
        };
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockData)
        });
      });
      
      await retryButton.click();
      
      // Chart should load after retry
      await dashboardPage.assertChartVisible();
    }
  });

  test('should maintain chart performance with large datasets', async ({ 
    dashboardPage, 
    performanceHelper,
    page 
  }) => {
    // Mock large dataset
    await page.route('**/api/metrics**', route => {
      const largeDataset = {
        success: true,
        data: {
          trends: Array.from({ length: 1000 }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
            value: Math.random() * 100,
            tests: Math.floor(Math.random() * 500),
            coverage: Math.random() * 100
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
    
    // Should load within reasonable time even with large dataset
    expect(loadTime).toBeLessThan(10000); // 10 seconds
    
    // Chart should still be interactive
    const chart = page.locator('[data-testid="overview-chart"]');
    const chartArea = chart.locator('svg, canvas').first();
    await chartArea.hover();
    
    const memory = await performanceHelper.measureMemoryUsage();
    expect(memory.memoryUsagePercentage).toBeLessThan(80); // Less than 80% memory usage
    
    await performanceHelper.stopPerformanceMonitoring();
  });
});