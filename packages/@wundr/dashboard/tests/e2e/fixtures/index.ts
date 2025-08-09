import { test as base, expect } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard-page';
import { WebSocketHelper } from '../helpers/websocket-helper';
import { PerformanceHelper } from '../helpers/performance-helper';
import { MockDataHelper } from '../helpers/mock-data-helper';

// Extend the base test with custom fixtures
export const test = base.extend<{
  dashboardPage: DashboardPage;
  websocketHelper: WebSocketHelper;
  performanceHelper: PerformanceHelper;
  mockDataHelper: MockDataHelper;
}>({
  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },

  websocketHelper: async ({ page }, use) => {
    const websocketHelper = new WebSocketHelper(page);
    await use(websocketHelper);
  },

  performanceHelper: async ({ page }, use) => {
    const performanceHelper = new PerformanceHelper(page);
    await use(performanceHelper);
  },

  mockDataHelper: async ({ page }, use) => {
    const mockDataHelper = new MockDataHelper(page);
    await use(mockDataHelper);
  },
});

export { expect };