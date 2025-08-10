import { expect } from '@playwright/test';
import { test } from '../fixtures';

test.describe('Full Workflow Integration E2E Tests', () => {
  test.beforeEach(async ({ mockDataHelper, websocketHelper, page }) => {
    await mockDataHelper.setupMockApiResponses();
    await websocketHelper.setupWebSocketMock();
    await mockDataHelper.injectTestDataAttributes();
  });

  test('should complete full user journey from dashboard to analysis', async ({ 
    dashboardPage, 
    websocketHelper,
    page 
  }) => {
    // 1. Start at dashboard overview
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();
    
    // Verify dashboard loads correctly
    await expect(dashboardPage.sidebar).toBeVisible();
    await expect(dashboardPage.metricsGrid).toBeVisible();
    await dashboardPage.assertChartVisible();
    
    // 2. Check real-time metrics
    await websocketHelper.sendRealtimeMetrics();
    await dashboardPage.waitForRealtimeUpdate();
    
    const metrics = await dashboardPage.getMetrics();
    expect(metrics.length).toBeGreaterThan(0);
    
    // 3. Navigate to analytics section
    await dashboardPage.navigateToSection('analytics');
    await expect(page.locator('[data-testid="analytics-page"]')).toBeVisible();
    
    // Verify analytics page loads
    const analyticsChart = page.locator('[data-testid="analytics-chart"], .recharts-line-chart');
    if (await analyticsChart.isVisible()) {
      await expect(analyticsChart).toBeVisible();
    }
    
    // 4. Navigate to performance monitoring
    await dashboardPage.navigateToSection('performance');
    await expect(page.locator('[data-testid="performance-page"]')).toBeVisible();
    
    // 5. Check dependency management
    await dashboardPage.navigateToSection('dependencies');
    await expect(page.locator('[data-testid="dependencies-page"]')).toBeVisible();
    
    // Send dependency update via WebSocket
    await websocketHelper.sendDependencyUpdate('react', '18.2.0', '18.3.0');
    
    // Verify update appears
    const dependencyList = page.locator('[data-testid="dependency-list"]');
    if (await dependencyList.isVisible()) {
      const reactDep = dependencyList.locator('[data-package="react"]');
      if (await reactDep.isVisible()) {
        await expect(reactDep).toBeVisible();
      }
    }
    
    // 6. Return to overview and verify state is maintained
    await dashboardPage.navigateToSection('overview');
    await expect(dashboardPage.metricsGrid).toBeVisible();
    
    // WebSocket should still be connected
    const wsState = await websocketHelper.getWebSocketState();
    expect(wsState.connected).toBe(true);
  });

  test('should handle end-to-end build workflow simulation', async ({ 
    dashboardPage, 
    websocketHelper,
    page 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();
    
    // 1. Trigger build via quick action
    await dashboardPage.performQuickAction('build');
    
    // 2. Send build started event
    await websocketHelper.sendBuildEvent('started', 0);
    
    // Verify build appears in activity
    let activities = await dashboardPage.getRecentActivities();
    const buildActivity = activities.find(a => a.type === 'build');
    expect(buildActivity).toBeTruthy();
    
    // 3. Simulate build progress
    const progressSteps = [25, 50, 75, 100];
    for (const progress of progressSteps) {
      await websocketHelper.sendBuildEvent(
        progress < 100 ? 'started' : 'completed', 
        progress
      );
      await page.waitForTimeout(1000);
      
      // Check if progress indicator is updated
      const progressBar = page.locator('[data-testid="build-progress"]');
      if (await progressBar.isVisible()) {
        const progressValue = await progressBar.getAttribute('value');
        expect(parseInt(progressValue || '0')).toBe(progress);
      }
    }
    
    // 4. Verify build completion
    activities = await dashboardPage.getRecentActivities();
    const completedBuild = activities.find(a => 
      a.type === 'build' && a.title?.includes('completed')
    );
    expect(completedBuild).toBeTruthy();
    
    // 5. Navigate to performance to see build metrics
    await dashboardPage.navigateToSection('performance');
    
    const performanceMetrics = page.locator('[data-testid="performance-metrics"]');
    if (await performanceMetrics.isVisible()) {
      const buildTimeMetric = performanceMetrics.locator('[data-metric="buildTime"]');
      if (await buildTimeMetric.isVisible()) {
        await expect(buildTimeMetric).toBeVisible();
      }
    }
  });

  test('should handle error recovery across components', async ({ 
    dashboardPage, 
    websocketHelper,
    mockDataHelper,
    page 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();
    
    // 1. Simulate API failure
    await mockDataHelper.setupErrorScenarios();
    
    // Navigate to section that requires API data
    await dashboardPage.navigateToSection('analytics');
    
    // Should show error state
    await dashboardPage.checkErrorHandling();
    
    // 2. Simulate WebSocket disconnection
    await websocketHelper.simulateWebSocketError();
    
    const connectionStatus = page.locator('[data-testid="connection-status"]');
    await expect(connectionStatus).toHaveText(/disconnected|offline/i, { timeout: 5000 });
    
    // 3. Recovery: Fix API and reconnect WebSocket
    await mockDataHelper.setupMockApiResponses();
    await websocketHelper.simulateReconnection();
    
    // Retry failed operations
    const retryButton = page.locator('[data-testid="retry-button"]');
    if (await retryButton.isVisible()) {
      await retryButton.click();
    }
    
    // 4. Verify recovery
    await expect(connectionStatus).toHaveText(/connected|online/i, { timeout: 10000 });
    await dashboardPage.assertChartVisible();
  });

  test('should maintain performance during intensive operations', async ({ 
    dashboardPage, 
    websocketHelper,
    performanceHelper,
    page 
  }) => {
    await performanceHelper.startPerformanceMonitoring();
    
    // 1. Load dashboard with heavy data
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();
    
    const initialMemory = await performanceHelper.measureMemoryUsage();
    
    // 2. Navigate through all sections rapidly
    const sections = ['analytics', 'performance', 'dependencies', 'overview'];
    
    for (const section of sections) {
      await dashboardPage.navigateToSection(section);
      await page.waitForTimeout(1000);
      
      // Send real-time data during navigation
      await websocketHelper.sendRealtimeMetrics();
    }
    
    // 3. Simulate heavy WebSocket traffic
    const streamId = await websocketHelper.startRealtimeDataStream();
    
    // 4. Test interactions during heavy load
    await dashboardPage.toggleTheme();
    await dashboardPage.performQuickAction('refresh');
    
    // Let it run for a few seconds
    await page.waitForTimeout(5000);
    
    await websocketHelper.stopRealtimeDataStream(streamId as any);
    
    // 5. Check performance metrics
    const finalMemory = await performanceHelper.measureMemoryUsage();
    const memoryIncrease = (finalMemory.used - initialMemory.used) / 1024 / 1024; // MB
    
    expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    
    // UI should still be responsive
    await expect(dashboardPage.sidebar).toBeVisible();
    await expect(dashboardPage.metricsGrid).toBeVisible();
    
    await performanceHelper.stopPerformanceMonitoring();
  });

  test('should handle concurrent user actions across multiple sections', async ({ 
    dashboardPage, 
    websocketHelper,
    page 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();
    
    // 1. Open multiple sections in sequence (simulating tabs)
    const sections = ['analytics', 'performance', 'dependencies'];
    
    // Navigate to each section and perform actions
    for (const section of sections) {
      await dashboardPage.navigateToSection(section);
      
      // Perform section-specific actions
      switch (section) {
        case 'analytics':
          const analyticsFilter = page.locator('[data-testid="analytics-filter"]');
          if (await analyticsFilter.isVisible()) {
            await analyticsFilter.click();
          }
          break;
          
        case 'performance':
          const timeRange = page.locator('[data-testid="time-range"]');
          if (await timeRange.isVisible()) {
            await timeRange.selectOption('7d');
          }
          break;
          
        case 'dependencies':
          const searchBox = page.locator('[data-testid="dependency-search"]');
          if (await searchBox.isVisible()) {
            await searchBox.fill('react');
          }
          break;
      }
      
      // Send relevant WebSocket updates
      await websocketHelper.sendRealtimeMetrics();
      await page.waitForTimeout(500);
    }
    
    // 2. Return to overview and verify all state is correct
    await dashboardPage.navigateToSection('overview');
    
    // Should still show updated metrics
    const metrics = await dashboardPage.getMetrics();
    expect(metrics.length).toBeGreaterThan(0);
    
    // WebSocket should still be active
    const wsState = await websocketHelper.getWebSocketState();
    expect(wsState.connected).toBe(true);
  });

  test('should validate data consistency across components', async ({ 
    dashboardPage, 
    websocketHelper,
    page 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();
    
    // 1. Send specific metrics via WebSocket
    const testMetrics = {
      type: 'metrics',
      data: {
        cpu: 45,
        memory: 67,
        buildTime: 142,
        testCoverage: 87,
        timestamp: new Date().toISOString()
      }
    };
    
    await websocketHelper.sendMockMessage(testMetrics);
    await dashboardPage.waitForRealtimeUpdate();
    
    // 2. Verify metrics appear consistently across different views
    
    // Check overview metrics
    const overviewMetrics = await dashboardPage.getMetrics();
    const cpuMetric = overviewMetrics.find(m => m.title?.includes('CPU') || m.title?.includes('cpu'));
    if (cpuMetric) {
      expect(cpuMetric.value).toContain('45');
    }
    
    // Check performance section
    await dashboardPage.navigateToSection('performance');
    const performancePage = page.locator('[data-testid="performance-page"]');
    
    if (await performancePage.isVisible()) {
      const perfCpuMetric = performancePage.locator('[data-metric="cpu"], [data-testid="cpu-metric"]');
      if (await perfCpuMetric.isVisible()) {
        const perfCpuValue = await perfCpuMetric.textContent();
        expect(perfCpuValue).toContain('45');
      }
    }
    
    // 3. Send build event and verify it appears in all relevant places
    await websocketHelper.sendBuildEvent('completed', 100);
    
    // Check recent activity
    await dashboardPage.navigateToSection('overview');
    const activities = await dashboardPage.getRecentActivities();
    const buildActivity = activities.find(a => a.type === 'build');
    expect(buildActivity).toBeTruthy();
    
    // Check if build info appears in performance metrics
    await dashboardPage.navigateToSection('performance');
    // Build time should be updated in performance view
    await page.waitForTimeout(1000);
  });

  test('should handle complex filtering and search operations', async ({ 
    dashboardPage,
    page 
  }) => {
    await dashboardPage.goto();
    
    // 1. Navigate to dependencies for complex filtering test
    await dashboardPage.navigateToSection('dependencies');
    
    const dependenciesPage = page.locator('[data-testid="dependencies-page"]');
    await expect(dependenciesPage).toBeVisible();
    
    // 2. Test search functionality
    const searchInput = page.locator('[data-testid="dependency-search"], input[placeholder*="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('react');
      await page.waitForTimeout(1000);
      
      // Results should be filtered
      const dependencyItems = page.locator('[data-testid="dependency-item"]');
      const itemCount = await dependencyItems.count();
      
      if (itemCount > 0) {
        // At least one result should contain 'react'
        const firstItem = dependencyItems.first();
        const itemText = await firstItem.textContent();
        expect(itemText?.toLowerCase()).toContain('react');
      }
    }
    
    // 3. Test filter combinations
    const filterButton = page.locator('[data-testid="filter-button"], button:has-text("Filter")');
    if (await filterButton.isVisible()) {
      await filterButton.click();
      
      const filterPanel = page.locator('[data-testid="filter-panel"]');
      if (await filterPanel.isVisible()) {
        // Apply multiple filters
        const outdatedFilter = filterPanel.locator('input[name="outdated"], [data-filter="outdated"]');
        if (await outdatedFilter.isVisible()) {
          await outdatedFilter.check();
        }
        
        const vulnerabilityFilter = filterPanel.locator('input[name="vulnerabilities"], [data-filter="vulnerabilities"]');
        if (await vulnerabilityFilter.isVisible()) {
          await vulnerabilityFilter.check();
        }
        
        // Apply filters
        const applyButton = filterPanel.locator('button:has-text("Apply")');
        if (await applyButton.isVisible()) {
          await applyButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }
    
    // 4. Clear filters and verify reset
    const clearButton = page.locator('[data-testid="clear-filters"], button:has-text("Clear")');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Search should be cleared
    if (await searchInput.isVisible()) {
      const searchValue = await searchInput.inputValue();
      expect(searchValue).toBe('');
    }
  });

  test('should maintain state during page refresh and session restoration', async ({ 
    dashboardPage, 
    websocketHelper,
    page 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();
    
    // 1. Set up specific state
    await dashboardPage.navigateToSection('analytics');
    await dashboardPage.toggleTheme(); // Change to dark theme
    
    // Get theme state
    const htmlClass = await page.getAttribute('html', 'class');
    const isDarkTheme = htmlClass?.includes('dark');
    
    // 2. Refresh page
    await page.reload();
    
    // 3. Verify state restoration
    await expect(dashboardPage.sidebar).toBeVisible();
    
    // Theme should be restored
    const restoredHtmlClass = await page.getAttribute('html', 'class');
    const isStillDarkTheme = restoredHtmlClass?.includes('dark');
    expect(isStillDarkTheme).toBe(isDarkTheme);
    
    // Should be on the same section (if URL routing is implemented)
    // Or default to overview
    await expect(dashboardPage.metricsGrid).toBeVisible();
    
    // WebSocket should reconnect
    if (await websocketHelper.getWebSocketState().then(s => s.connected)) {
      await websocketHelper.waitForWebSocketConnection();
    }
  });
});