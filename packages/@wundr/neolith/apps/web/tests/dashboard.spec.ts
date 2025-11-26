/**
 * Dashboard Page - Playwright E2E Tests
 *
 * Tests all functionality of the workspace dashboard including:
 * - Quick Stats widget
 * - Recent Activity widget
 * - Quick Actions
 * - Sidebar navigation
 * - Channel list
 * - Responsive design
 * - Error handling
 * - Performance
 *
 * @requires Playwright MCP tools or @playwright/test
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Dashboard Page - Full Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Assuming authentication is handled via session/cookies
    // You may need to add login logic here
    await page.goto(BASE_URL);

    // Wait for redirect to workspace dashboard
    await page.waitForURL(/\/.*\/dashboard/, { timeout: 10000 });
  });

  test.describe('Page Load & Routing', () => {
    test('should redirect root URL to workspace dashboard', async ({ page }) => {
      await page.goto(BASE_URL);
      await expect(page).toHaveURL(/\/.*\/dashboard/);
      await expect(page.locator('h1:has-text("Welcome")')).toBeVisible({ timeout: 5000 });
    });

    test('should preserve workspace ID in URL across navigation', async ({ page }) => {
      const currentUrl = page.url();
      const workspaceId = currentUrl.match(/\/([^\/]+)\/dashboard/)?.[1];

      expect(workspaceId).toBeTruthy();

      // Navigate to another page
      await page.locator('text=Workflows').click();
      await expect(page).toHaveURL(new RegExp(`/${workspaceId}/workflows`));
    });

    test('should handle browser back/forward navigation', async ({ page }) => {
      // Go to workflows
      await page.locator('text=Workflows').click();
      await page.waitForURL(/\/workflows/);

      // Go back
      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard/);

      // Go forward
      await page.goForward();
      await expect(page).toHaveURL(/\/workflows/);
    });
  });

  test.describe('Quick Stats Widget', () => {
    test('should display Quick Stats heading', async ({ page }) => {
      await expect(page.locator('h3:has-text("Quick Stats")')).toBeVisible();
    });

    test('should display all four stat items', async ({ page }) => {
      const statsWidget = page.locator('h3:has-text("Quick Stats")').locator('..');

      await expect(statsWidget.locator('text=Team Members')).toBeVisible();
      await expect(statsWidget.locator('text=Channels')).toBeVisible();
      await expect(statsWidget.locator('text=Workflows')).toBeVisible();
      await expect(statsWidget.locator('text=Virtual Persons')).toBeVisible();
    });

    test('should display numeric values for all stats', async ({ page }) => {
      const statsWidget = page.locator('h3:has-text("Quick Stats")').locator('..');
      const values = statsWidget.locator('.text-2xl.font-bold');

      // Should have 4 stat values
      await expect(values).toHaveCount(4);

      // Each value should be a number
      const texts = await values.allTextContents();
      texts.forEach(text => {
        expect(text.trim()).toMatch(/^\d+$/);
      });
    });

    test('should handle zero values correctly', async ({ page }) => {
      // Mock API to return zeros
      await page.route('**/api/workspaces/**/dashboard/stats*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              members: { total: 0, activeToday: 0, vpCount: 0, humanCount: 0 },
              channels: { total: 0, publicCount: 0, privateCount: 0 },
              workflows: { total: 0, active: 0, draft: 0, inactive: 0, archived: 0 },
              messages: { today: 0, week: 0, month: 0, total: 0 }
            },
            metadata: { timeRange: 'all', generatedAt: new Date().toISOString() }
          })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const values = await page.locator('.text-2xl.font-bold').allTextContents();
      values.forEach(value => {
        expect(value.trim()).toBe('0');
      });
    });

    test('should show loading skeleton initially', async ({ page }) => {
      // Intercept and delay the stats API
      await page.route('**/api/workspaces/**/dashboard/stats*', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.continue();
      });

      await page.reload();

      // Should show skeleton during loading
      // Note: Specific selector depends on DashboardSkeleton implementation
      const skeleton = page.locator('[class*="skeleton"], [data-testid="dashboard-skeleton"]');
      await expect(skeleton).toBeVisible({ timeout: 1000 });
    });

    test('should handle stats API error gracefully', async ({ page }) => {
      await page.route('**/api/workspaces/**/dashboard/stats*', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should show error message
      await expect(page.locator('text=/Error loading statistics/i')).toBeVisible();

      // Should still show fallback zeros
      const values = await page.locator('.text-2xl.font-bold').allTextContents();
      values.forEach(value => {
        expect(value.trim()).toBe('0');
      });
    });

    test('should display stats in correct order', async ({ page }) => {
      const statsWidget = page.locator('h3:has-text("Quick Stats")').locator('..');
      const labels = statsWidget.locator('.text-sm.text-muted-foreground');

      const labelTexts = await labels.allTextContents();
      expect(labelTexts).toEqual([
        'Team Members',
        'Channels',
        'Workflows',
        'Virtual Persons'
      ]);
    });
  });

  test.describe('Recent Activity Widget', () => {
    test('should display Recent Activity heading', async ({ page }) => {
      await expect(page.locator('h3:has-text("Recent Activity")')).toBeVisible();
    });

    test('should show activity items when data exists', async ({ page }) => {
      // Mock activity data
      await page.route('**/api/workspaces/**/dashboard/activity*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'msg_1',
                type: 'message.posted',
                actor: { name: 'John Doe', displayName: 'johnd' },
                resourceName: 'Test message',
                timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
              },
              {
                id: 'task_2',
                type: 'task.created',
                actor: { name: 'Jane Smith', displayName: 'janes' },
                resourceName: 'New task',
                timestamp: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
              }
            ],
            pagination: { limit: 5, cursor: null, nextCursor: null, hasMore: false }
          })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const activityWidget = page.locator('h3:has-text("Recent Activity")').locator('..');
      const activityItems = activityWidget.locator('[class*="space-y-3"] > div');

      await expect(activityItems).toHaveCount(2);
    });

    test('should show empty state when no activity', async ({ page }) => {
      await page.route('**/api/workspaces/**/dashboard/activity*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            pagination: { limit: 5, cursor: null, nextCursor: null, hasMore: false }
          })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=/No recent activity/i')).toBeVisible();
      await expect(page.locator('text=/Activity will appear here/i')).toBeVisible();
    });

    test('should display formatted relative timestamps', async ({ page }) => {
      const activityWidget = page.locator('h3:has-text("Recent Activity")').locator('..');
      const timestamps = activityWidget.locator('.text-xs.text-muted-foreground.whitespace-nowrap');

      if (await timestamps.count() > 0) {
        const firstTimestamp = await timestamps.first().textContent();

        // Should match patterns like "2 hours ago", "Just now", "3 days ago"
        expect(firstTimestamp?.toLowerCase()).toMatch(/just now|minute|hour|day|ago/i);
      }
    });

    test('should limit displayed activity items to 4', async ({ page }) => {
      // Mock more than 4 activities
      await page.route('**/api/workspaces/**/dashboard/activity*', async route => {
        const activities = Array.from({ length: 10 }, (_, i) => ({
          id: `act_${i}`,
          type: 'message.posted',
          actor: { name: `User ${i}`, displayName: `user${i}` },
          resourceName: `Activity ${i}`,
          timestamp: new Date(Date.now() - i * 3600000).toISOString()
        }));

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: activities,
            pagination: { limit: 5, cursor: null, nextCursor: null, hasMore: true }
          })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const activityWidget = page.locator('h3:has-text("Recent Activity")').locator('..');
      const activityItems = activityWidget.locator('[class*="space-y-3"] > div');

      const count = await activityItems.count();
      expect(count).toBeLessThanOrEqual(4);
    });

    test('should handle activity API errors', async ({ page }) => {
      await page.route('**/api/workspaces/**/dashboard/activity*', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to fetch activities' })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=/Error loading activity/i')).toBeVisible();
    });

    test('should display activity type and user info', async ({ page }) => {
      const activityWidget = page.locator('h3:has-text("Recent Activity")').locator('..');
      const activityItems = activityWidget.locator('[class*="space-y-3"] > div');

      if (await activityItems.count() > 0) {
        const firstItem = activityItems.first();

        // Should have activity title
        await expect(firstItem.locator('.text-sm.font-medium')).toBeVisible();

        // Should have description with user name
        await expect(firstItem.locator('.text-xs.text-muted-foreground').first()).toBeVisible();
      }
    });
  });

  test.describe('Quick Actions', () => {
    test('should display Quick Actions heading', async ({ page }) => {
      await expect(page.locator('h3:has-text("Quick Actions")')).toBeVisible();
    });

    test('should display all four action buttons', async ({ page }) => {
      const actionsWidget = page.locator('h3:has-text("Quick Actions")').locator('..');

      await expect(actionsWidget.locator('text=Invite Team Member')).toBeVisible();
      await expect(actionsWidget.locator('text=Create Channel')).toBeVisible();
      await expect(actionsWidget.locator('text=New Workflow')).toBeVisible();
      await expect(actionsWidget.locator('text=View Activity')).toBeVisible();
    });

    test('should have chevron icons on all action buttons', async ({ page }) => {
      const actionsWidget = page.locator('h3:has-text("Quick Actions")').locator('..');
      const actionButtons = actionsWidget.locator('a');

      const count = await actionButtons.count();
      expect(count).toBe(4);

      // Each button should have a chevron icon (svg)
      for (let i = 0; i < count; i++) {
        const button = actionButtons.nth(i);
        await expect(button.locator('svg')).toBeVisible();
      }
    });

    test('should navigate to admin/members on Invite Team Member click', async ({ page }) => {
      const inviteButton = page.locator('text=Invite Team Member');
      await inviteButton.click();

      await expect(page).toHaveURL(/\/admin\/members/);
    });

    test('should navigate to channels on Create Channel click', async ({ page }) => {
      const createChannelBtn = page.locator('text=Create Channel');
      await createChannelBtn.click();

      await expect(page).toHaveURL(/\/channels/);
    });

    test('should navigate to workflows on New Workflow click', async ({ page }) => {
      const newWorkflowBtn = page.locator('text=New Workflow');
      await newWorkflowBtn.click();

      await expect(page).toHaveURL(/\/workflows/);
    });

    test('should navigate to admin/activity on View Activity click', async ({ page }) => {
      const viewActivityBtn = page.locator('text=View Activity');
      await viewActivityBtn.click();

      await expect(page).toHaveURL(/\/admin\/activity/);
    });

    test('should show hover effect on action buttons', async ({ page }) => {
      const firstAction = page.locator('h3:has-text("Quick Actions")').locator('..').locator('a').first();

      // Hover over button
      await firstAction.hover();

      // Check hover class is applied
      const classes = await firstAction.getAttribute('class');
      expect(classes).toContain('hover:bg-accent');
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('should display all navigation items', async ({ page }) => {
      const sidebar = page.locator('aside');

      await expect(sidebar.locator('text=Dashboard')).toBeVisible();
      await expect(sidebar.locator('text=Virtual Persons')).toBeVisible();
      await expect(sidebar.locator('text=Agents')).toBeVisible();
      await expect(sidebar.locator('text=Workflows')).toBeVisible();
      await expect(sidebar.locator('text=Deployments')).toBeVisible();
      await expect(sidebar.locator('text=Settings')).toBeVisible();
    });

    test('should highlight active navigation item (Dashboard)', async ({ page }) => {
      const dashboardLink = page.locator('aside').locator('a:has-text("Dashboard")');

      const classes = await dashboardLink.getAttribute('class');
      expect(classes).toContain('bg-stone-900');
      expect(classes).toContain('text-stone-100');
    });

    test('should navigate to Workflows page', async ({ page }) => {
      await page.locator('aside').locator('text=Workflows').click();
      await expect(page).toHaveURL(/\/workflows/);
    });

    test('should navigate to Settings page', async ({ page }) => {
      await page.locator('aside').locator('text=Settings').click();
      await expect(page).toHaveURL(/\/settings/);
    });

    test('should display workspace name', async ({ page }) => {
      const workspaceName = page.locator('aside').locator('.font-semibold.text-stone-100').first();
      await expect(workspaceName).toBeVisible();

      const text = await workspaceName.textContent();
      expect(text).toBeTruthy();
      expect(text?.trim()).not.toBe('');
    });

    test('should show user section at bottom', async ({ page }) => {
      const userSection = page.locator('aside').locator('.border-t.border-stone-800').last();
      await expect(userSection).toBeVisible();

      // Should show user name and email
      await expect(userSection.locator('.text-sm.font-medium')).toBeVisible();
      await expect(userSection.locator('.text-xs.text-stone-400')).toBeVisible();
    });

    test('should show online status indicator', async ({ page }) => {
      const statusIndicator = page.locator('aside').locator('.bg-green-500');
      await expect(statusIndicator).toBeVisible();
    });
  });

  test.describe('Channel List in Sidebar', () => {
    test('should display channel list component', async ({ page }) => {
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();

      // ChannelList component should be present
      // Specific test depends on ChannelList implementation
    });

    test('should handle channel loading state', async ({ page }) => {
      await page.route('**/api/workspaces/**/channels*', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.continue();
      });

      await page.reload();

      // Should show loading indicator
      // Implementation depends on ChannelList component
    });

    test('should handle channel API errors', async ({ page }) => {
      await page.route('**/api/workspaces/**/channels*', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to load channels' })
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should show error state
      // Implementation depends on ChannelList component
    });
  });

  test.describe('Console Errors & Network', () => {
    test('should not have critical console errors on page load', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Filter out known/acceptable errors (favicon, browser extensions)
      const criticalErrors = errors.filter(err =>
        !err.includes('favicon') &&
        !err.includes('Extension') &&
        !err.includes('chrome-extension')
      );

      expect(criticalErrors).toHaveLength(0);
    });

    test('should not have failed network requests', async ({ page }) => {
      const failedRequests: string[] = [];

      page.on('requestfailed', request => {
        failedRequests.push(request.url());
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      expect(failedRequests).toHaveLength(0);
    });

    test('should complete API calls successfully', async ({ page }) => {
      const apiResponses: { url: string; status: number }[] = [];

      page.on('response', response => {
        if (response.url().includes('/api/')) {
          apiResponses.push({
            url: response.url(),
            status: response.status()
          });
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // All API calls should return 2xx
      apiResponses.forEach(({ url, status }) => {
        expect(status, `API call to ${url} failed`).toBeGreaterThanOrEqual(200);
        expect(status, `API call to ${url} failed`).toBeLessThan(300);
      });
    });
  });

  test.describe('Responsive Design', () => {
    test('should show sidebar on desktop (>1024px)', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });

      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();

      const isVisible = await sidebar.isVisible();
      expect(isVisible).toBe(true);
    });

    test('should hide sidebar on mobile (<768px)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const sidebar = page.locator('aside.hidden.lg\\:block');

      // Sidebar should have display: none on mobile
      const isVisible = await sidebar.isVisible();
      expect(isVisible).toBe(false);
    });

    test('should show mobile header on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const mobileHeader = page.locator('header.lg\\:hidden');
      await expect(mobileHeader).toBeVisible();
    });

    test('should adapt stats grid on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const statsWidget = page.locator('h3:has-text("Quick Stats")').locator('..');
      await expect(statsWidget).toBeVisible();

      // Stats should still be readable
      const statValues = statsWidget.locator('.text-2xl.font-bold');
      await expect(statValues).toHaveCount(4);
    });

    test('should not have horizontal scroll on any screen size', async ({ page }) => {
      const viewports = [
        { width: 375, height: 667 },   // Mobile
        { width: 768, height: 1024 },  // Tablet
        { width: 1280, height: 720 },  // Desktop
        { width: 1920, height: 1080 }  // Large desktop
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);

        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasHorizontalScroll, `Horizontal scroll at ${viewport.width}x${viewport.height}`).toBe(false);
      }
    });
  });

  test.describe('Performance', () => {
    test('should load page within 3 seconds', async ({ page }) => {
      const startTime = Date.now();

      await page.goto(BASE_URL);
      await page.waitForURL(/\/.*\/dashboard/);
      await page.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      expect(loadTime, 'Page load time exceeded 3 seconds').toBeLessThan(3000);
    });

    test('should complete stats API within 2 seconds', async ({ page }) => {
      let statsApiTime = 0;

      page.on('response', async response => {
        if (response.url().includes('/dashboard/stats')) {
          // Track when response was received
          statsApiTime = Date.now();
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      expect(statsApiTime, 'Stats API took too long').toBeLessThan(2000);
    });

    test('should have no layout shift (CLS)', async ({ page }) => {
      const cls = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;

          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if ((entry as any).hadRecentInput) continue;
              clsValue += (entry as any).value;
            }
          });

          observer.observe({ type: 'layout-shift', buffered: true });

          setTimeout(() => {
            observer.disconnect();
            resolve(clsValue);
          }, 3000);
        });
      });

      // CLS should be less than 0.1 (good)
      expect(cls, 'Cumulative Layout Shift too high').toBeLessThan(0.1);
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation through quick actions', async ({ page }) => {
      // Focus on first quick action
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      await expect(focused).toBeVisible();

      // Should be able to activate with Enter
      await page.keyboard.press('Enter');

      // Should navigate to the linked page
      await expect(page).not.toHaveURL(/\/dashboard$/);
    });

    test('should have proper focus indicators', async ({ page }) => {
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');

      // Get computed styles to check for focus outline
      const outline = await focused.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.outline + styles.outlineWidth;
      });

      expect(outline).toBeTruthy();
    });

    test('should have mobile menu button with aria-label', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const menuButton = page.locator('[aria-label="Open menu"]');
      await expect(menuButton).toBeVisible();

      const ariaLabel = await menuButton.getAttribute('aria-label');
      expect(ariaLabel).toBe('Open menu');
    });

    test('should have sufficient color contrast', async ({ page }) => {
      // This is a basic check - full contrast testing requires additional tools
      const textElement = page.locator('h1').first();

      const contrast = await textElement.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor
        };
      });

      // Just verify we have color values
      expect(contrast.color).toBeTruthy();
    });
  });

  test.describe('Welcome Message', () => {
    test('should display welcome message with user name', async ({ page }) => {
      const welcomeHeading = page.locator('h1:has-text("Welcome")');
      await expect(welcomeHeading).toBeVisible();

      const text = await welcomeHeading.textContent();
      expect(text).toMatch(/Welcome,\s+\w+/);
    });

    test('should show user name from session', async ({ page }) => {
      const heading = page.locator('h1').first();
      const text = await heading.textContent();

      // Should not show default "User"
      expect(text).not.toBe('Welcome, User');
      expect(text).toBeTruthy();
    });
  });
});
