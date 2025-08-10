import { expect } from '@playwright/test';
import { test } from '../fixtures';

test.describe('WebSocket Real-time Flow E2E Tests', () => {
  test.beforeEach(async ({ websocketHelper, mockDataHelper, page }) => {
    await websocketHelper.setupWebSocketMock();
    await mockDataHelper.setupMockApiResponses();
    await mockDataHelper.injectTestDataAttributes();
  });

  test('should establish WebSocket connection and receive real-time metrics', async ({ 
    dashboardPage, 
    websocketHelper 
  }) => {
    await dashboardPage.goto();
    
    // Wait for WebSocket connection
    await websocketHelper.waitForWebSocketConnection();
    
    const wsState = await websocketHelper.getWebSocketState();
    expect(wsState.connected).toBe(true);
    expect(wsState.url).toContain('ws://localhost:8080');

    // Send mock real-time metrics
    await websocketHelper.sendRealtimeMetrics();
    
    // Verify metrics are updated in UI
    await dashboardPage.waitForRealtimeUpdate();
    
    const metrics = await dashboardPage.getMetrics();
    expect(metrics.length).toBeGreaterThan(0);
    
    // Verify at least one metric has a value
    const hasMetricWithValue = metrics.some(metric => 
      metric.value && metric.value !== '0' && metric.value !== '-'
    );
    expect(hasMetricWithValue).toBe(true);
  });

  test('should handle WebSocket reconnection gracefully', async ({ 
    dashboardPage, 
    websocketHelper,
    page 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();

    // Simulate connection loss
    await websocketHelper.simulateWebSocketError();
    
    // Verify error handling
    const connectionStatus = page.locator('[data-testid="connection-status"]');
    await expect(connectionStatus).toHaveText(/disconnected|offline/i, { timeout: 5000 });

    // Simulate reconnection
    await websocketHelper.simulateReconnection();
    
    // Verify reconnection
    await expect(connectionStatus).toHaveText(/connected|online/i, { timeout: 10000 });
  });

  test('should display real-time build events', async ({ 
    dashboardPage, 
    websocketHelper 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();

    // Send build started event
    await websocketHelper.sendBuildEvent('started', 0);
    
    // Verify build event appears in recent activity
    const activities = await dashboardPage.getRecentActivities();
    const buildActivity = activities.find(activity => 
      activity.type === 'build' && activity.title?.includes('started')
    );
    expect(buildActivity).toBeTruthy();

    // Send build progress updates
    for (let progress = 25; progress <= 100; progress += 25) {
      await websocketHelper.sendBuildEvent(
        progress < 100 ? 'started' : 'completed', 
        progress
      );
      await dashboardPage.page.waitForTimeout(500);
    }

    // Verify build completion
    const updatedActivities = await dashboardPage.getRecentActivities();
    const completedBuild = updatedActivities.find(activity => 
      activity.type === 'build' && activity.title?.includes('completed')
    );
    expect(completedBuild).toBeTruthy();
  });

  test('should handle high-frequency WebSocket messages without performance degradation', async ({ 
    dashboardPage, 
    websocketHelper,
    performanceHelper 
  }) => {
    await performanceHelper.startPerformanceMonitoring();
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();

    const initialMemory = await performanceHelper.measureMemoryUsage();
    
    // Send rapid-fire messages
    for (let i = 0; i < 50; i++) {
      await websocketHelper.sendRealtimeMetrics();
      await dashboardPage.page.waitForTimeout(100);
    }

    const finalMemory = await performanceHelper.measureMemoryUsage();
    
    // Memory usage should not increase dramatically
    const memoryIncrease = (finalMemory.used - initialMemory.used) / 1024 / 1024; // MB
    expect(memoryIncrease).toBeLessThan(20); // Less than 20MB increase

    // UI should still be responsive
    await dashboardPage.performQuickAction('refresh');
    await expect(dashboardPage.metricsGrid).toBeVisible();

    await performanceHelper.stopPerformanceMonitoring();
  });

  test('should maintain WebSocket connection during page interactions', async ({ 
    dashboardPage, 
    websocketHelper 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();

    // Navigate to different sections
    await dashboardPage.navigateToSection('analytics');
    await dashboardPage.page.waitForTimeout(1000);
    
    let wsState = await websocketHelper.getWebSocketState();
    expect(wsState.connected).toBe(true);

    await dashboardPage.navigateToSection('performance');
    await dashboardPage.page.waitForTimeout(1000);
    
    wsState = await websocketHelper.getWebSocketState();
    expect(wsState.connected).toBe(true);

    // Toggle theme
    await dashboardPage.toggleTheme();
    await dashboardPage.page.waitForTimeout(1000);
    
    wsState = await websocketHelper.getWebSocketState();
    expect(wsState.connected).toBe(true);

    // Verify real-time data still flows
    await websocketHelper.sendRealtimeMetrics();
    await dashboardPage.waitForRealtimeUpdate();
  });

  test('should handle malformed WebSocket messages gracefully', async ({ 
    dashboardPage, 
    websocketHelper,
    page 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();

    // Send malformed JSON
    await websocketHelper.sendMockMessage('invalid json');
    
    // Send message with missing fields
    await websocketHelper.sendMockMessage({ type: 'metrics' }); // missing data
    
    // Send message with incorrect type
    await websocketHelper.sendMockMessage({ 
      type: 'unknown_type', 
      data: { value: 123 } 
    });

    // Dashboard should remain functional
    await expect(dashboardPage.sidebar).toBeVisible();
    await expect(dashboardPage.metricsGrid).toBeVisible();

    // No error messages should be displayed to user
    const errorDialog = page.locator('[role="dialog"][data-testid="error-dialog"]');
    await expect(errorDialog).not.toBeVisible();
  });

  test('should aggregate and display dependency updates from WebSocket', async ({ 
    dashboardPage, 
    websocketHelper 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();

    // Send multiple dependency updates
    const dependencies = [
      { name: 'react', oldVersion: '18.2.0', newVersion: '18.3.0' },
      { name: 'typescript', oldVersion: '4.9.5', newVersion: '5.0.0' },
      { name: 'next', oldVersion: '13.4.0', newVersion: '13.5.0' }
    ];

    for (const dep of dependencies) {
      await websocketHelper.sendDependencyUpdate(dep.name, dep.oldVersion, dep.newVersion);
      await dashboardPage.page.waitForTimeout(500);
    }

    // Navigate to dependencies section
    await dashboardPage.navigateToSection('dependencies');
    
    // Verify updates are reflected
    const dependencyList = dashboardPage.page.locator('[data-testid="dependency-list"]');
    await expect(dependencyList).toBeVisible();

    // Check for update indicators
    for (const dep of dependencies) {
      const depItem = dependencyList.locator(`[data-package="${dep.name}"]`);
      await expect(depItem).toBeVisible();
      
      const updateIndicator = depItem.locator('[data-testid="update-indicator"]');
      await expect(updateIndicator).toBeVisible();
    }
  });

  test('should maintain WebSocket performance under load', async ({ 
    dashboardPage, 
    websocketHelper,
    performanceHelper 
  }) => {
    await dashboardPage.goto();
    await websocketHelper.waitForWebSocketConnection();

    // Start continuous performance monitoring
    const metricsPromise = performanceHelper.startContinuousMonitoring(10000);
    
    // Start real-time data stream
    const streamId = await websocketHelper.startRealtimeDataStream();

    // Let it run for 10 seconds
    await dashboardPage.page.waitForTimeout(10000);
    
    // Stop data stream
    await websocketHelper.stopRealtimeDataStream(streamId as any);
    
    // Get performance metrics
    const metrics = await metricsPromise;
    
    // Verify performance remained stable
    const avgFps = metrics.reduce((sum, m) => sum + m.fps, 0) / metrics.length;
    expect(avgFps).toBeGreaterThan(15); // Should maintain reasonable FPS

    const maxMemory = Math.max(...metrics.map(m => m.memory.used));
    const minMemory = Math.min(...metrics.map(m => m.memory.used));
    const memoryGrowth = (maxMemory - minMemory) / 1024 / 1024; // MB
    
    expect(memoryGrowth).toBeLessThan(10); // Memory shouldn't grow more than 10MB
  });

  test('should handle WebSocket connection timeout and retry', async ({ 
    dashboardPage, 
    websocketHelper,
    page 
  }) => {
    // Block WebSocket connections to simulate timeout
    await page.route('ws://localhost:8080', route => {
      // Don't respond to simulate timeout
      return new Promise(() => {});
    });

    await dashboardPage.goto();

    // Verify connection timeout handling
    const connectionStatus = page.locator('[data-testid="connection-status"]');
    await expect(connectionStatus).toHaveText(/connecting|failed|offline/i, { timeout: 15000 });

    // Unblock connections
    await page.unroute('ws://localhost:8080');
    await websocketHelper.setupWebSocketMock();

    // Should retry and connect
    const retryButton = page.locator('[data-testid="retry-connection"]');
    if (await retryButton.isVisible()) {
      await retryButton.click();
    }

    await expect(connectionStatus).toHaveText(/connected|online/i, { timeout: 10000 });
  });
});