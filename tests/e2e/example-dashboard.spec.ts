import { test, expect } from '@playwright/test';
import { pageLoadTemplate, getPageLoadMetrics } from '@/templates/page-load.template';
import { responsiveBreakpointsTemplate } from '@/templates/responsive-breakpoints.template';
import { skeletonLoaderTemplate } from '@/templates/skeleton-loader.template';
import { setupTestPage, setupAuthentication, setupMockAPIs } from '@/helpers/test-setup';
import { TEST_USERS } from '@/helpers/common-fixtures';

/**
 * Example test suite using templates
 *
 * This demonstrates how to use the template library for testing
 * a typical dashboard page with authentication and responsive design.
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test page with common configuration
    await setupTestPage(page, {
      clearStorage: true,
      setViewport: { width: 1280, height: 720 },
    });

    // Setup authentication
    const token = 'test-jwt-token-12345';
    await setupAuthentication(page, token, {
      storageKey: 'auth_token',
      headerName: 'Authorization',
    });

    // Setup mock APIs
    await setupMockAPIs(page, [
      {
        pattern: '**/api/user',
        response: {
          id: '123',
          name: 'Test User',
          email: TEST_USERS.user.email,
          avatar: 'https://example.com/avatar.jpg',
        },
        status: 200,
      },
      {
        pattern: '**/api/dashboard/cards',
        response: {
          cards: [
            { id: '1', title: 'Total Revenue', value: '$45,231.89', icon: 'trending-up' },
            { id: '2', title: 'Active Users', value: '2,543', icon: 'users' },
            { id: '3', title: 'Conversion Rate', value: '12.5%', icon: 'pie-chart' },
            { id: '4', title: 'Total Orders', value: '12,543', icon: 'shopping-cart' },
          ],
        },
        status: 200,
      },
      {
        pattern: '**/api/dashboard/chart-data',
        response: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          data: [4000, 3000, 2000, 2780, 1890, 2390],
        },
        status: 200,
      },
    ]);
  });

  test('page loads with all critical elements', async ({ page }) => {
    // Use page load template to verify basic page loading
    await pageLoadTemplate(page, {
      url: '/dashboard',
      expectedTitle: /Dashboard/i,
      expectedElements: [
        '[data-testid="header"]',
        '[data-testid="sidebar"]',
        '[data-testid="main-content"]',
        '[data-testid="footer"]',
      ],
      maxLoadTime: 3000,
      waitForSelector: '[data-testid="main-content"]',
      expectNetworkIdle: true,
    });

    // Get and log performance metrics
    const metrics = await getPageLoadMetrics(page);
    console.log('Page Load Metrics:', {
      domContentLoaded: metrics.domContentLoaded,
      loadComplete: metrics.loadComplete,
      firstPaint: metrics.firstPaint,
    });

    // Verify user is authenticated
    const userGreeting = page.locator('[data-testid="user-greeting"]');
    await expect(userGreeting).toContainText('Test User');
  });

  test('displays skeleton loaders while loading data', async ({ page }) => {
    await page.goto('/dashboard');

    // Use skeleton loader template to verify loading states
    await skeletonLoaderTemplate(page, {
      url: '/dashboard',
      skeletonSelectors: ['[data-testid="card-skeleton"]'],
      contentSelectors: ['[data-testid="card"]'],
      shouldShow: 'both',
      spinnerSelector: '[data-testid="loading-spinner"]',
      transitionTimeout: 5000,
      checkAnimations: true,
      checkAccessibility: true,
      onSkeletonVisible: async (page) => {
        console.log('Skeleton loaders visible during initial load');
      },
      onContentVisible: async (page) => {
        console.log('Content loaded and skeleton disappeared');
      },
    });

    // Verify cards have actual content
    const cards = page.locator('[data-testid="card"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify no skeletons remain
    const skeletons = page.locator('[data-testid="card-skeleton"]');
    await expect(skeletons).not.toBeVisible();
  });

  test('is responsive across breakpoints', async ({ page }) => {
    await page.goto('/dashboard');

    // Use responsive template to test multiple screen sizes
    await responsiveBreakpointsTemplate(page, {
      url: '/dashboard',
      breakpoints: ['mobile', 'tablet', 'desktop'],
      elementVisibility: {
        mobile: {
          visible: ['[data-testid="mobile-nav"]'],
          hidden: ['[data-testid="desktop-sidebar"]'],
        },
        tablet: {
          visible: ['[data-testid="main-content"]'],
          hidden: [],
        },
        desktop: {
          visible: ['[data-testid="desktop-sidebar"]', '[data-testid="header"]'],
          hidden: ['[data-testid="mobile-nav"]'],
        },
      },
      noLayoutShift: true,
      checkTextReadability: true,
      checkTouchTargets: true,
      minTouchTargetSize: 44,
      onBreakpointChange: async (breakpoint) => {
        console.log(`Testing ${breakpoint.name}: ${breakpoint.width}x${breakpoint.height}`);
      },
    });

    // Verify dashboard adapts correctly
    const mainContent = page.locator('[data-testid="main-content"]');
    await expect(mainContent).toBeVisible();
  });

  test('displays dashboard cards correctly', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for cards to load
    await page.waitForSelector('[data-testid="card"]', { timeout: 5000 });

    // Verify card count matches API response (4 cards)
    const cards = page.locator('[data-testid="card"]');
    expect(await cards.count()).toBe(4);

    // Verify each card has required elements
    for (let i = 0; i < 4; i++) {
      const card = cards.nth(i);
      const title = card.locator('[data-testid="card-title"]');
      const value = card.locator('[data-testid="card-value"]');

      await expect(title).toBeVisible();
      await expect(value).toBeVisible();
    }
  });

  test('displays chart data correctly', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for chart to render
    const chart = page.locator('[data-testid="chart"]');
    await expect(chart).toBeVisible({ timeout: 5000 });

    // Verify chart has data points
    const dataPoints = page.locator('[data-testid="chart-data-point"]');
    const pointCount = await dataPoints.count();
    expect(pointCount).toBe(6); // 6 months of data
  });

  test('user profile section displays correctly', async ({ page }) => {
    await page.goto('/dashboard');

    // Verify user profile is visible
    const profile = page.locator('[data-testid="user-profile"]');
    await expect(profile).toBeVisible();

    // Verify user info
    const userName = page.locator('[data-testid="user-name"]');
    const userEmail = page.locator('[data-testid="user-email"]');
    const userAvatar = page.locator('[data-testid="user-avatar"]');

    await expect(userName).toContainText('Test User');
    await expect(userEmail).toContainText(TEST_USERS.user.email);
    await expect(userAvatar).toBeVisible();
  });

  test('navigation works correctly', async ({ page }) => {
    await page.goto('/dashboard');

    // Find navigation items
    const navItems = page.locator('[data-testid="nav-item"]');
    const navCount = await navItems.count();

    expect(navCount).toBeGreaterThan(0);

    // Click on a navigation item
    if (navCount > 1) {
      const secondNavItem = navItems.nth(1);
      await secondNavItem.click();

      // Verify navigation occurred
      await page.waitForLoadState('networkidle');
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/dashboard');
    }
  });

  test('handles missing data gracefully', async ({ page, context }) => {
    // Setup empty response
    await context.route('**/api/dashboard/cards', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ cards: [] }),
      });
    });

    await page.goto('/dashboard');

    // Verify empty state is shown
    const emptyState = page.locator('[data-testid="no-cards-message"]');
    await expect(emptyState).toBeVisible({ timeout: 5000 });
  });

  test('handles API errors gracefully', async ({ page, context }) => {
    // Setup error response
    await context.route('**/api/dashboard/cards', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/dashboard');

    // Verify error message is shown
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Verify retry button exists
    const retryButton = page.locator('[data-testid="retry-button"]');
    await expect(retryButton).toBeVisible();
  });

  test('redirects to login if not authenticated', async ({ page, context }) => {
    // Clear authentication
    await context.clearCookies();

    // Try to access dashboard
    await page.goto('/dashboard');

    // Should redirect to login
    expect(page.url()).toContain('/login');
  });
});
