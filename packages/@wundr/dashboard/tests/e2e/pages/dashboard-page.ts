import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly header: Locator;
  readonly metricsGrid: Locator;
  readonly overviewChart: Locator;
  readonly realtimeMetrics: Locator;
  readonly recentActivity: Locator;
  readonly quickActions: Locator;
  readonly themeToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('[data-testid="app-sidebar"]');
    this.header = page.locator('[data-testid="app-header"]');
    this.metricsGrid = page.locator('[data-testid="metrics-grid"]');
    this.overviewChart = page.locator('[data-testid="overview-chart"]');
    this.realtimeMetrics = page.locator('[data-testid="realtime-metrics"]');
    this.recentActivity = page.locator('[data-testid="recent-activity"]');
    this.quickActions = page.locator('[data-testid="quick-actions"]');
    this.themeToggle = page.locator('[data-testid="theme-toggle"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.waitForDashboardReady();
  }

  async waitForDashboardReady() {
    // Wait for core dashboard components to load
    await expect(this.sidebar).toBeVisible({ timeout: 10000 });
    await expect(this.header).toBeVisible({ timeout: 10000 });
    await expect(this.metricsGrid).toBeVisible({ timeout: 10000 });
    
    // Mark dashboard as ready for other tests
    await this.page.addInitScript(() => {
      const readyIndicator = document.createElement('div');
      readyIndicator.setAttribute('data-testid', 'dashboard-ready');
      readyIndicator.style.display = 'none';
      document.body.appendChild(readyIndicator);
    });
  }

  async navigateToSection(section: string) {
    const sectionSelector = `[data-testid="nav-${section}"]`;
    await this.page.locator(sectionSelector).click();
    await this.page.waitForURL(`**/dashboard/${section}`);
  }

  async toggleTheme() {
    const currentTheme = await this.page.getAttribute('html', 'class');
    await this.themeToggle.click();
    
    // Wait for theme change
    await this.page.waitForFunction(
      (oldTheme) => document.documentElement.className !== oldTheme,
      currentTheme,
      { timeout: 5000 }
    );
  }

  async getMetrics() {
    await expect(this.metricsGrid).toBeVisible();
    
    const metrics = await this.metricsGrid.locator('[data-testid="metric-card"]').all();
    const results = [];
    
    for (const metric of metrics) {
      const title = await metric.locator('[data-testid="metric-title"]').textContent();
      const value = await metric.locator('[data-testid="metric-value"]').textContent();
      const change = await metric.locator('[data-testid="metric-change"]').textContent();
      
      results.push({ title, value, change });
    }
    
    return results;
  }

  async waitForRealtimeUpdate() {
    const initialTimestamp = await this.realtimeMetrics
      .locator('[data-testid="last-update"]')
      .getAttribute('data-timestamp');
    
    // Wait for timestamp to change (indicating real-time update)
    await this.page.waitForFunction(
      (oldTimestamp) => {
        const currentElement = document.querySelector('[data-testid="last-update"]');
        return currentElement?.getAttribute('data-timestamp') !== oldTimestamp;
      },
      initialTimestamp,
      { timeout: 15000 }
    );
  }

  async getRecentActivities() {
    await expect(this.recentActivity).toBeVisible();
    
    const activities = await this.recentActivity.locator('[data-testid="activity-item"]').all();
    const results = [];
    
    for (const activity of activities) {
      const title = await activity.locator('[data-testid="activity-title"]').textContent();
      const time = await activity.locator('[data-testid="activity-time"]').textContent();
      const type = await activity.getAttribute('data-activity-type');
      
      results.push({ title, time, type });
    }
    
    return results;
  }

  async performQuickAction(action: string) {
    const actionButton = this.quickActions.locator(`[data-testid="quick-action-${action}"]`);
    await expect(actionButton).toBeVisible();
    await actionButton.click();
  }

  async assertChartVisible() {
    await expect(this.overviewChart).toBeVisible();
    
    // Check if chart has rendered data
    const chartCanvas = this.overviewChart.locator('canvas, svg');
    await expect(chartCanvas).toBeVisible();
    
    // Verify chart has data points
    const chartData = await this.page.evaluate(() => {
      const chart = document.querySelector('[data-testid="overview-chart"]');
      return chart?.getAttribute('data-has-data') === 'true';
    });
    
    expect(chartData).toBeTruthy();
  }

  async checkResponsiveLayout() {
    // Test mobile layout
    await this.page.setViewportSize({ width: 375, height: 667 });
    await expect(this.sidebar).toBeHidden(); // Should be hidden on mobile
    
    // Test tablet layout
    await this.page.setViewportSize({ width: 768, height: 1024 });
    await expect(this.metricsGrid).toBeVisible();
    
    // Test desktop layout
    await this.page.setViewportSize({ width: 1200, height: 800 });
    await expect(this.sidebar).toBeVisible();
    await expect(this.metricsGrid).toBeVisible();
  }

  async simulateError() {
    // Simulate network error or other error conditions
    await this.page.route('**/api/**', route => route.abort());
    await this.page.reload();
  }

  async checkErrorHandling() {
    const errorMessage = this.page.locator('[data-testid="error-message"]');
    const retryButton = this.page.locator('[data-testid="retry-button"]');
    
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    await expect(retryButton).toBeVisible();
  }
}