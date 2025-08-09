import { test, expect, Page, BrowserContext, devices } from '@playwright/test';

test.describe('Mobile and Responsive E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;

  const mobileDevices = [
    { name: 'iPhone 12', device: devices['iPhone 12'] },
    { name: 'iPhone 13 Pro', device: devices['iPhone 13 Pro'] },
    { name: 'Samsung Galaxy S21', device: devices['Galaxy S21'] },
    { name: 'Pixel 5', device: devices['Pixel 5'] }
  ];

  const tabletDevices = [
    { name: 'iPad', device: devices['iPad'] },
    { name: 'iPad Pro', device: devices['iPad Pro'] },
    { name: 'Samsung Galaxy Tab', device: devices['Galaxy Tab S4'] }
  ];

  test.describe('Mobile Dashboard Experience', () => {
    for (const mobileDevice of mobileDevices) {
      test(`should provide optimal experience on ${mobileDevice.name}`, async ({ browser }) => {
        context = await browser.newContext(mobileDevice.device);
        page = await context.newPage();

        // 1. Test initial load and layout
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Verify mobile layout is active
        await expect(page.locator('.mobile-layout')).toBeVisible();
        await expect(page.locator('.desktop-sidebar')).not.toBeVisible();

        // 2. Test mobile navigation
        const hamburgerButton = page.locator('.mobile-menu-toggle');
        await expect(hamburgerButton).toBeVisible();
        await hamburgerButton.click();

        const mobileMenu = page.locator('.mobile-menu');
        await expect(mobileMenu).toBeVisible();

        // Test menu items are accessible
        await expect(page.locator('.mobile-menu .nav-item')).toHaveCount.greaterThan(3);

        // 3. Test navigation functionality
        await page.click('.mobile-menu .nav-item:has-text("Analysis")');
        await expect(page).toHaveURL(/.*\/dashboard\/analysis/);
        await expect(mobileMenu).not.toBeVisible(); // Menu should close after navigation

        // 4. Test touch interactions
        await page.goto('/dashboard/analysis/dependencies');
        await page.waitForSelector('.dependency-graph', { timeout: 10000 });

        // Test pinch-to-zoom simulation
        const graph = page.locator('.dependency-graph');
        await graph.click(); // Focus the element

        // Simulate touch gestures
        await page.touchscreen.tap(200, 300);
        await expect(page.locator('.node-details')).toBeVisible({ timeout: 2000 });

        // 5. Test responsive forms
        await page.goto('/dashboard/settings');
        
        const formInputs = page.locator('input, select, textarea');
        const inputCount = await formInputs.count();
        
        for (let i = 0; i < Math.min(inputCount, 3); i++) {
          const input = formInputs.nth(i);
          await expect(input).toBeVisible();
          
          // Verify input is touch-friendly (min 44px height)
          const boundingBox = await input.boundingBox();
          expect(boundingBox?.height || 0).toBeGreaterThanOrEqual(44);
        }

        await context.close();
      });
    }

    test('should handle orientation changes gracefully', async ({ browser }) => {
      context = await browser.newContext(devices['iPhone 12']);
      page = await context.newPage();

      // 1. Test portrait orientation
      await page.goto('/dashboard/analysis');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('.mobile-layout')).toBeVisible();
      const portraitMetrics = await page.locator('.metric-card').count();

      // 2. Simulate landscape orientation
      await page.setViewportSize({ width: 844, height: 390 }); // iPhone 12 landscape
      await page.waitForTimeout(500); // Allow layout to adjust

      // Verify layout adapts to landscape
      await expect(page.locator('.landscape-layout, .mobile-layout')).toBeVisible();
      
      const landscapeMetrics = await page.locator('.metric-card').count();
      expect(landscapeMetrics).toBe(portraitMetrics); // Content should remain the same

      // 3. Test chart rotation
      await page.goto('/dashboard/analysis/metrics');
      await page.waitForSelector('.chart-container');

      const chartContainer = page.locator('.chart-container');
      const landscapeBox = await chartContainer.boundingBox();
      
      // Chart should use available width in landscape
      expect(landscapeBox?.width || 0).toBeGreaterThan(600);

      await context.close();
    });

    test('should optimize touch targets and accessibility', async ({ browser }) => {
      context = await browser.newContext(devices['Pixel 5']);
      page = await context.newPage();

      await page.goto('/dashboard');

      // 1. Test touch target sizes
      const interactiveElements = page.locator('button, a, input, [role="button"]');
      const elementCount = await interactiveElements.count();

      for (let i = 0; i < Math.min(elementCount, 10); i++) {
        const element = interactiveElements.nth(i);
        if (await element.isVisible()) {
          const boundingBox = await element.boundingBox();
          
          // Touch targets should be at least 44x44px
          expect(boundingBox?.width || 0).toBeGreaterThanOrEqual(44);
          expect(boundingBox?.height || 0).toBeGreaterThanOrEqual(44);
        }
      }

      // 2. Test spacing between touch targets
      const buttons = page.locator('button:visible');
      const buttonCount = await buttons.count();

      if (buttonCount > 1) {
        const firstButton = buttons.first();
        const secondButton = buttons.nth(1);

        const firstBox = await firstButton.boundingBox();
        const secondBox = await secondButton.boundingBox();

        if (firstBox && secondBox) {
          const distance = Math.abs(
            (firstBox.x + firstBox.width / 2) - (secondBox.x + secondBox.width / 2)
          );
          
          // Buttons should have adequate spacing (at least 8px)
          expect(distance).toBeGreaterThan(52); // 44px + 8px spacing
        }
      }

      // 3. Test accessibility features
      await expect(page.locator('[aria-label]')).toHaveCount.greaterThan(5);
      await expect(page.locator('[role]')).toHaveCount.greaterThan(3);

      // Test screen reader compatibility
      const mainContent = page.locator('[role="main"]');
      await expect(mainContent).toBeVisible();

      await context.close();
    });
  });

  test.describe('Tablet Dashboard Experience', () => {
    for (const tabletDevice of tabletDevices) {
      test(`should provide optimal tablet experience on ${tabletDevice.name}`, async ({ browser }) => {
        context = await browser.newContext(tabletDevice.device);
        page = await context.newPage();

        // 1. Test tablet-optimized layout
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Tablet should show hybrid layout
        await expect(page.locator('.tablet-layout')).toBeVisible();
        
        // Should have sidebar but collapsible
        const sidebar = page.locator('.sidebar');
        await expect(sidebar).toBeVisible();

        // 2. Test dashboard grid adaptation
        await page.goto('/dashboard/analysis');
        
        const metricCards = page.locator('.metric-card');
        const cardCount = await metricCards.count();
        
        // Tablet should show 2-3 cards per row
        if (cardCount >= 2) {
          const firstCard = metricCards.first();
          const secondCard = metricCards.nth(1);

          const firstBox = await firstCard.boundingBox();
          const secondBox = await secondCard.boundingBox();

          // Cards should be side by side on tablet
          if (firstBox && secondBox) {
            expect(Math.abs(firstBox.y - secondBox.y)).toBeLessThan(50);
          }
        }

        // 3. Test data visualization on tablet
        await page.goto('/dashboard/analysis/dependencies');
        await page.waitForSelector('.dependency-graph');

        const graphContainer = page.locator('.dependency-graph');
        const graphBox = await graphContainer.boundingBox();

        // Graph should use tablet screen real estate effectively
        expect(graphBox?.width || 0).toBeGreaterThan(600);
        expect(graphBox?.height || 0).toBeGreaterThan(400);

        // 4. Test tablet-specific interactions
        // Test hover states (tablets often support hover)
        await page.hover('.metric-card:first-child');
        await expect(page.locator('.metric-card:first-child .hover-details')).toBeVisible({ timeout: 1000 });

        // Test two-finger scroll simulation
        await page.mouse.wheel(0, -200);
        await page.waitForTimeout(100);
        
        // Page should scroll smoothly
        const scrollPosition = await page.evaluate(() => window.scrollY);
        expect(scrollPosition).toBeGreaterThan(0);

        await context.close();
      });
    }

    test('should handle tablet multi-column layouts effectively', async ({ browser }) => {
      context = await browser.newContext(devices['iPad Pro']);
      page = await context.newPage();

      // 1. Test split-pane layout
      await page.goto('/dashboard/analysis/files');
      await page.waitForLoadState('networkidle');

      // iPad Pro should show split view
      const filesList = page.locator('.files-list');
      const fileDetails = page.locator('.file-details');

      await expect(filesList).toBeVisible();
      await expect(fileDetails).toBeVisible();

      // Both panes should be visible simultaneously
      const filesBox = await filesList.boundingBox();
      const detailsBox = await fileDetails.boundingBox();

      expect(filesBox?.width || 0).toBeGreaterThan(300);
      expect(detailsBox?.width || 0).toBeGreaterThan(400);

      // 2. Test master-detail interaction
      await page.click('.file-item:first-child');
      
      // Details pane should update
      await expect(page.locator('.file-details .file-name')).toBeVisible();
      await expect(page.locator('.file-details .file-content')).toBeVisible();

      // 3. Test tablet toolbar
      const toolbar = page.locator('.toolbar');
      await expect(toolbar).toBeVisible();

      const toolbarButtons = page.locator('.toolbar button');
      const buttonCount = await toolbarButtons.count();

      // Tablet should show expanded toolbar
      expect(buttonCount).toBeGreaterThan(5);

      await context.close();
    });
  });

  test.describe('Cross-Device Data Synchronization', () => {
    test('should maintain data consistency across device switches', async ({ browser }) => {
      // 1. Start session on mobile
      let mobileContext = await browser.newContext(devices['iPhone 12']);
      let mobilePage = await mobileContext.newPage();

      await mobilePage.goto('/dashboard/settings');
      await mobilePage.fill('input[name="user-preference"]', 'mobile-setting');
      await mobilePage.click('button:has-text("Save")');
      
      await expect(mobilePage.locator('.settings-saved')).toBeVisible();

      // Simulate user closing mobile session
      await mobileContext.close();

      // 2. Switch to tablet
      let tabletContext = await browser.newContext(devices['iPad']);
      let tabletPage = await tabletContext.newPage();

      await tabletPage.goto('/dashboard/settings');
      
      // Setting should be synchronized
      const savedValue = await tabletPage.locator('input[name="user-preference"]').inputValue();
      expect(savedValue).toBe('mobile-setting');

      // 3. Make change on tablet
      await tabletPage.fill('input[name="user-preference"]', 'tablet-setting');
      await tabletPage.click('button:has-text("Save")');

      await tabletContext.close();

      // 4. Switch back to mobile and verify sync
      mobileContext = await browser.newContext(devices['iPhone 12']);
      mobilePage = await mobileContext.newPage();

      await mobilePage.goto('/dashboard/settings');
      
      const finalValue = await mobilePage.locator('input[name="user-preference"]').inputValue();
      expect(finalValue).toBe('tablet-setting');

      await mobileContext.close();
    });

    test('should handle offline-online transitions', async ({ browser }) => {
      context = await browser.newContext(devices['Pixel 5']);
      page = await context.newPage();

      // 1. Load dashboard while online
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // 2. Go offline
      await context.setOffline(true);

      // Dashboard should show offline indicator
      await expect(page.locator('.offline-indicator')).toBeVisible({ timeout: 5000 });

      // 3. Try to navigate (should use cached data)
      await page.click('text=Analysis');
      await expect(page).toHaveURL(/.*\/dashboard\/analysis/);

      // Should show cached content with offline warning
      await expect(page.locator('.offline-warning')).toBeVisible();
      await expect(page.locator('.metric-card')).toHaveCount.greaterThan(0);

      // 4. Make changes while offline
      await page.goto('/dashboard/settings');
      await page.fill('input[name="theme"]', 'dark');
      await page.click('button:has-text("Save")');

      // Should show pending sync indicator
      await expect(page.locator('.sync-pending')).toBeVisible();

      // 5. Go back online
      await context.setOffline(false);

      // Should auto-sync and show success
      await expect(page.locator('.sync-complete')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.offline-indicator')).not.toBeVisible();

      await context.close();
    });
  });

  test.describe('Performance on Mobile Devices', () => {
    test('should maintain good performance on lower-end devices', async ({ browser }) => {
      // Simulate lower-end device with slower CPU
      context = await browser.newContext({
        ...devices['Galaxy S21'],
        // Simulate slower device
        extraHTTPHeaders: {
          'X-Test-Device-Performance': 'low'
        }
      });
      page = await context.newPage();

      // Throttle CPU to simulate lower-end device
      const client = await page.context().newCDPSession(page);
      await client.send('Emulation.setCPUThrottlingRate', { rate: 6 }); // 6x slower

      // 1. Test initial load performance
      const startTime = performance.now();
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      const loadTime = performance.now() - startTime;

      // Should load within 5 seconds even on slower device
      expect(loadTime).toBeLessThan(5000);

      // 2. Test scrolling performance
      const scrollStartTime = performance.now();
      
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(50);
      }
      
      const scrollTime = performance.now() - scrollStartTime;
      expect(scrollTime).toBeLessThan(2000); // Smooth scrolling

      // 3. Test visualization performance
      await page.goto('/dashboard/analysis/dependencies');
      
      const vizStartTime = performance.now();
      await page.waitForSelector('.dependency-graph', { timeout: 15000 });
      const vizLoadTime = performance.now() - vizStartTime;

      // Visualization should load within 10 seconds on slower device
      expect(vizLoadTime).toBeLessThan(10000);

      await context.close();
    });

    test('should optimize battery usage', async ({ browser }) => {
      context = await browser.newContext(devices['iPhone 12']);
      page = await context.newPage();

      // 1. Monitor animation and update frequency
      await page.goto('/dashboard/monitoring');
      
      // Enable power-saving mode simulation
      await page.evaluate(() => {
        // Simulate battery API (if supported)
        (navigator as any).getBattery = () => Promise.resolve({
          level: 0.2, // Low battery
          charging: false,
          dischargingTime: 3600 // 1 hour
        });
      });

      await page.reload();

      // 2. Verify reduced animations in power-save mode
      const animationElements = page.locator('[data-animation]');
      const animationCount = await animationElements.count();

      for (let i = 0; i < animationCount; i++) {
        const element = animationElements.nth(i);
        const animationDuration = await element.evaluate(el => {
          return window.getComputedStyle(el).animationDuration;
        });
        
        // Animations should be reduced or disabled
        expect(['0s', 'none']).toContain(animationDuration);
      }

      // 3. Test reduced refresh rates
      await page.click('button:has-text("Enable Real-time Updates")');
      
      // Monitor update frequency
      let updateCount = 0;
      const startTime = Date.now();
      
      page.on('response', response => {
        if (response.url().includes('/api/live-data')) {
          updateCount++;
        }
      });

      await page.waitForTimeout(10000); // Monitor for 10 seconds
      
      const updateRate = updateCount / 10; // updates per second
      expect(updateRate).toBeLessThan(0.5); // Should be reduced for battery saving

      await context.close();
    });
  });

  test.describe('Accessibility on Mobile', () => {
    test('should support screen readers on mobile', async ({ browser }) => {
      context = await browser.newContext(devices['iPhone 12']);
      page = await context.newPage();

      await page.goto('/dashboard');

      // 1. Test ARIA landmarks
      await expect(page.locator('[role="banner"]')).toBeVisible(); // Header
      await expect(page.locator('[role="main"]')).toBeVisible();   // Main content
      await expect(page.locator('[role="navigation"]')).toBeVisible(); // Navigation

      // 2. Test heading structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(3);

      // Verify proper heading hierarchy
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1); // Should have exactly one H1

      // 3. Test focus management
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Test skip links
      await page.keyboard.press('Tab');
      const skipLink = page.locator('.skip-link');
      if (await skipLink.isVisible()) {
        await page.keyboard.press('Enter');
        const mainContent = page.locator('[role="main"]');
        await expect(mainContent).toBeFocused();
      }

      // 4. Test mobile-specific accessibility
      const mobileMenuButton = page.locator('.mobile-menu-toggle');
      await expect(mobileMenuButton).toHaveAttribute('aria-expanded');
      
      await mobileMenuButton.click();
      await expect(mobileMenuButton).toHaveAttribute('aria-expanded', 'true');

      await context.close();
    });

    test('should support voice control gestures', async ({ browser }) => {
      context = await browser.newContext(devices['iPhone 12']);
      page = await context.newPage();

      await page.goto('/dashboard');

      // 1. Test voice-over friendly labels
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        
        // Button should have accessible name
        const ariaLabel = await button.getAttribute('aria-label');
        const textContent = await button.textContent();
        
        expect(ariaLabel || textContent).toBeTruthy();
        expect((ariaLabel || textContent || '').trim().length).toBeGreaterThan(0);
      }

      // 2. Test form labels
      const inputs = page.locator('input, select, textarea');
      const inputCount = await inputs.count();

      for (let i = 0; i < Math.min(inputCount, 3); i++) {
        const input = inputs.nth(i);
        const inputId = await input.getAttribute('id');
        
        if (inputId) {
          const label = page.locator(`label[for="${inputId}"]`);
          await expect(label).toBeVisible();
        }
      }

      // 3. Test alternative text for images
      const images = page.locator('img');
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const image = images.nth(i);
        const altText = await image.getAttribute('alt');
        expect(altText).toBeTruthy();
      }

      await context.close();
    });
  });
});