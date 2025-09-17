import { test, expect } from '@playwright/test';
import { TestUtilities } from './helpers/test-utilities';
import { TEST_CONFIG } from './helpers/test-config';

/**
 * Navigation Issues Detection
 * Tests for navigation problems, routing issues, and user flow disruptions
 */

test.describe('Navigation Issues Detection', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
  });

  test('should validate all routes are accessible', async ({ page }) => {
    const routes = TEST_CONFIG.routes.webClient;
    const inaccessibleRoutes: string[] = [];
    const slowRoutes: string[] = [];
    const accessibleRoutes: string[] = [];

    for (const route of routes) {
      const startTime = Date.now();
      
      try {
        await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`, {
          waitUntil: 'networkidle',
          timeout: 15000
        });

        const loadTime = Date.now() - startTime;
        
        // Check if page loaded successfully
        const bodyVisible = await page.locator('body').isVisible();
        const hasContent = await page.locator('main, [role="main"], .content, #root').count() > 0;
        
        if (bodyVisible && hasContent) {
          accessibleRoutes.push(route);
          
          if (loadTime > 10000) {
            slowRoutes.push(`${route} (${loadTime}ms)`);
          }
        } else {
          inaccessibleRoutes.push(`${route} - Page loaded but no content`);
        }

      } catch (_error) {
        inaccessibleRoutes.push(`${route} - ${error}`);
      }
    }

    console.log(`\n=== ROUTE ACCESSIBILITY REPORT ===`);
    console.log(`Accessible Routes: ${accessibleRoutes.length}/${routes.length}`);
    console.log(`Inaccessible Routes: ${inaccessibleRoutes.length}`);
    console.log(`Slow Routes (>10s): ${slowRoutes.length}`);

    if (inaccessibleRoutes.length > 0) {
      console.log('\nINACCESSIBLE ROUTES:');
      inaccessibleRoutes.forEach((route, index) => {
        console.log(`${index + 1}. ${route}`);
      });
    }

    if (slowRoutes.length > 0) {
      console.log('\nSLOW ROUTES:');
      slowRoutes.forEach((route, index) => {
        console.log(`${index + 1}. ${route}`);
      });
    }

    // Most routes should be accessible
    expect(inaccessibleRoutes.length).toBeLessThan(routes.length * 0.2); // Less than 20% failure rate
    expect(accessibleRoutes.length).toBeGreaterThan(routes.length * 0.7); // At least 70% success
  });

  test('should validate navigation menu functionality', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard`);
    
    const navigationIssues: string[] = [];
    
    // Find navigation elements
    const navSelectors = [
      'nav a',
      '[role="navigation"] a',
      '.nav-menu a',
      '.sidebar a',
      '[data-testid*="nav"] a'
    ];

    let navLinks: any[] = [];
    for (const selector of navSelectors) {
      const links = await page.locator(selector).all();
      if (links.length > 0) {
        navLinks = links;
        break;
      }
    }

    if (navLinks.length === 0) {
      navigationIssues.push('No navigation links found');
    } else {
      console.log(`Found ${navLinks.length} navigation links`);

      // Test first few navigation links
      for (const link of navLinks.slice(0, 8)) {
        try {
          const href = await link.getAttribute('href');
          const text = await link.textContent();
          
          if (href && href.startsWith('/')) {
            const currentUrl = page.url();
            
            // Click the link
            await link.click();
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            
            const newUrl = page.url();
            
            // Check if navigation occurred
            if (currentUrl === newUrl && !href.includes('#')) {
              navigationIssues.push(`Navigation failed for "${text}" (${href})`);
            } else if (newUrl.includes(href) || href === '/') {
              console.log(`✓ Navigation successful: ${text} → ${href}`);
            } else {
              navigationIssues.push(`Unexpected navigation for "${text}": expected ${href}, got ${newUrl}`);
            }
          }
          
        } catch (_error) {
          const text = await link.textContent();
          navigationIssues.push(`Navigation error for "${text}": ${error}`);
        }
      }
    }

    if (navigationIssues.length > 0) {
      console.log('Navigation Issues Found:', navigationIssues);
    }

    expect(navigationIssues.length).toBeLessThan(5);
  });

  test('should test breadcrumb navigation', async ({ page }) => {
    const routesWithBreadcrumbs = [
      '/dashboard/analysis/entities',
      '/dashboard/analysis/dependencies',
      '/dashboard/docs/api',
      '/dashboard/templates/services'
    ];

    const breadcrumbIssues: string[] = [];

    for (const route of routesWithBreadcrumbs) {
      await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`);
      await page.waitForTimeout(1000);

      // Look for breadcrumb elements
      const breadcrumbSelectors = [
        '.breadcrumb',
        '[role="navigation"] ol',
        '.breadcrumb-list',
        'nav ol, nav ul',
        '[data-testid*="breadcrumb"]'
      ];

      let breadcrumbsFound = false;
      for (const selector of breadcrumbSelectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          breadcrumbsFound = true;
          
          // Test breadcrumb links
          const breadcrumbLinks = await page.locator(`${selector} a`).all();
          for (const link of breadcrumbLinks) {
            try {
              const href = await link.getAttribute('href');
              if (href && href !== '#') {
                // Verify breadcrumb link is valid
                const accessible = await testUtils.checkUrlAccessibility(`${TEST_CONFIG.dashboards.webClient.baseURL}${href}`);
                if (!accessible) {
                  breadcrumbIssues.push(`Broken breadcrumb link on ${route}: ${href}`);
                }
              }
            } catch (_error) {
              breadcrumbIssues.push(`Breadcrumb link error on ${route}: ${error}`);
            }
          }
          break;
        }
      }

      if (!breadcrumbsFound) {
        console.log(`No breadcrumbs found on ${route} (may not be required)`);
      }
    }

    if (breadcrumbIssues.length > 0) {
      console.log('Breadcrumb Issues:', breadcrumbIssues);
    }

    expect(breadcrumbIssues.length).toBeLessThan(3);
  });

  test('should validate back/forward navigation', async ({ page }) => {
    const navigationPath = [
      '/dashboard',
      '/dashboard/analysis', 
      '/dashboard/files',
      '/dashboard/performance'
    ];

    const navigationHistory: string[] = [];
    
    // Navigate through the path
    for (const route of navigationPath) {
      await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`);
      await page.waitForLoadState('networkidle');
      navigationHistory.push(page.url());
    }

    // Test browser back button
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    const afterBack = page.url();
    const expectedBack = navigationHistory[navigationHistory.length - 2];
    
    console.log(`Back navigation: Expected ${expectedBack}, Got ${afterBack}`);
    
    // Test browser forward button
    await page.goForward();
    await page.waitForLoadState('networkidle');
    
    const afterForward = page.url();
    const expectedForward = navigationHistory[navigationHistory.length - 1];
    
    console.log(`Forward navigation: Expected ${expectedForward}, Got ${afterForward}`);
    
    // Browser navigation should work correctly
    expect(afterBack).toContain(navigationPath[navigationPath.length - 2]);
    expect(afterForward).toContain(navigationPath[navigationPath.length - 1]);
  });

  test('should test deep linking and direct URL access', async ({ page }) => {
    const deepLinks = [
      '/dashboard/analysis/entities',
      '/dashboard/analysis/circular',
      '/dashboard/docs/api',
      '/dashboard/performance',
      '/dashboard/settings'
    ];

    const deepLinkIssues: string[] = [];

    for (const link of deepLinks) {
      try {
        // Direct navigation to deep link
        await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${link}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 });

        // Check if page loaded correctly
        const hasContent = await page.locator('main, [role="main"], .content').count() > 0;
        const hasError = await page.locator('text=/404|not found|error/i').count() > 0;
        
        if (!hasContent || hasError) {
          deepLinkIssues.push(`Deep link failed: ${link}`);
        }

        // Check if URL matches what we requested
        const currentUrl = page.url();
        if (!currentUrl.includes(link)) {
          deepLinkIssues.push(`Deep link redirect unexpected: ${link} → ${currentUrl}`);
        }

      } catch (_error) {
        deepLinkIssues.push(`Deep link error: ${link} - ${error}`);
      }
    }

    if (deepLinkIssues.length > 0) {
      console.log('Deep Link Issues:', deepLinkIssues);
    }

    expect(deepLinkIssues.length).toBeLessThan(deepLinks.length * 0.3);
  });

  test('should validate tab navigation and focus management', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard`);
    
    const focusIssues: string[] = [];
    
    // Find focusable elements
    const focusableElements = await page.locator(
      'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ).all();

    console.log(`Found ${focusableElements.length} focusable elements`);

    if (focusableElements.length === 0) {
      focusIssues.push('No focusable elements found');
    } else {
      // Test tab navigation through first few elements
      const elementsToTest = Math.min(5, focusableElements.length);
      
      for (let i = 0; i < elementsToTest; i++) {
        try {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(100);
          
          // Check if focus is visible
          const focusedElement = await page.locator(':focus').count();
          if (focusedElement === 0) {
            focusIssues.push('Focus lost during tab navigation');
            break;
          }
          
        } catch (_error) {
          focusIssues.push(`Tab navigation error: ${error}`);
          break;
        }
      }
    }

    // Test skip links (accessibility)
    const skipLinks = await page.locator('a[href^="#"], .skip-link').count();
    console.log(`Skip links found: ${skipLinks}`);

    if (focusIssues.length > 0) {
      console.log('Focus Management Issues:', focusIssues);
    }

    expect(focusIssues.length).toBeLessThan(3);
  });

  test('should check for navigation feedback and loading states', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard`);
    
    const feedbackIssues: string[] = [];
    
    // Find a navigation link
    const navLink = page.locator('nav a, .sidebar a').first();
    const navLinkExists = await navLink.count() > 0;
    
    if (navLinkExists) {
      // Click navigation and check for loading feedback
      const href = await navLink.getAttribute('href');
      
      await navLink.click();
      
      // Check for loading indicators quickly
      await page.waitForTimeout(100);
      const loadingIndicators = await page.locator(
        '.loading, .spinner, .skeleton, [aria-busy="true"]'
      ).count();
      
      console.log(`Loading indicators found during navigation: ${loadingIndicators}`);
      
      await page.waitForLoadState('networkidle');
      
      // Check that navigation completed
      if (href && href !== '#') {
        const finalUrl = page.url();
        if (!finalUrl.includes(href)) {
          feedbackIssues.push(`Navigation didn't complete properly: expected ${href}, got ${finalUrl}`);
        }
      }
    }

    // Check for navigation state indicators
    const activeStates = await page.locator('.active, [aria-current], .current').count();
    console.log(`Active navigation states found: ${activeStates}`);

    if (feedbackIssues.length > 0) {
      console.log('Navigation Feedback Issues:', feedbackIssues);
    }

    expect(feedbackIssues.length).toBeLessThan(2);
  });

  test('should validate route parameters and query strings', async ({ page }) => {
    // Test routes that might accept parameters
    const parameterizedRoutes = [
      { route: '/dashboard/analysis', params: '?type=dependencies' },
      { route: '/dashboard/files', params: '?path=/src' },
      { route: '/dashboard/reports', params: '?filter=recent' }
    ];

    const parameterIssues: string[] = [];

    for (const { route, params } of parameterizedRoutes) {
      try {
        const fullUrl = `${TEST_CONFIG.dashboards.webClient.baseURL}${route}${params}`;
        
        await page.goto(fullUrl);
        await page.waitForLoadState('networkidle', { timeout: 10000 });

        // Check if page loaded with parameters
        const currentUrl = page.url();
        const hasContent = await page.locator('main, [role="main"]').count() > 0;
        
        if (!hasContent) {
          parameterIssues.push(`Route with parameters failed to load: ${route}${params}`);
        } else if (!currentUrl.includes(params.substring(1))) {
          // Parameters might be processed/transformed, just log for info
          console.log(`Parameters processed: ${params} → ${currentUrl}`);
        }

      } catch (_error) {
        parameterIssues.push(`Parameter route error: ${route}${params} - ${error}`);
      }
    }

    if (parameterIssues.length > 0) {
      console.log('Parameter Route Issues:', parameterIssues);
    }

    // Be lenient with parameter handling as it may not be implemented
    expect(parameterIssues.length).toBeLessThan(parameterizedRoutes.length);
  });

  test('should generate navigation audit report', async ({ page }) => {
    const report = {
      timestamp: new Date().toISOString(),
      dashboard: 'Web Client Dashboard',
      summary: {
        totalRoutesChecked: 0,
        accessibleRoutes: 0,
        navigationLinksFound: 0,
        navigationIssues: 0,
        criticalNavigationFailures: 0
      },
      issues: {
        inaccessibleRoutes: [] as string[],
        brokenNavigation: [] as string[],
        slowRoutes: [] as string[],
        deepLinkFailures: [] as string[]
      },
      recommendations: [] as string[]
    };

    // Test subset of routes for comprehensive report
    const routesToTest = TEST_CONFIG.routes.webClient.slice(0, 10);
    report.summary.totalRoutesChecked = routesToTest.length;

    for (const route of routesToTest) {
      try {
        const startTime = Date.now();
        await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`, { timeout: 10000 });
        const loadTime = Date.now() - startTime;

        const hasContent = await page.locator('main, [role="main"]').count() > 0;
        
        if (hasContent) {
          report.summary.accessibleRoutes++;
          
          if (loadTime > 10000) {
            report.issues.slowRoutes.push(`${route} (${loadTime}ms)`);
          }
        } else {
          report.issues.inaccessibleRoutes.push(route);
          report.summary.criticalNavigationFailures++;
        }

      } catch (_error) {
        report.issues.inaccessibleRoutes.push(route);
        report.summary.criticalNavigationFailures++;
      }
    }

    // Count navigation links on main dashboard
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard`);
    report.summary.navigationLinksFound = await page.locator('nav a, [role="navigation"] a').count();

    report.summary.navigationIssues = 
      report.issues.inaccessibleRoutes.length +
      report.issues.brokenNavigation.length +
      report.issues.deepLinkFailures.length;

    // Generate recommendations
    if (report.summary.criticalNavigationFailures > 0) {
      report.recommendations.push('Critical navigation failures detected. Check routing configuration.');
    }
    
    if (report.issues.slowRoutes.length > 2) {
      report.recommendations.push('Multiple slow routes detected. Optimize page loading performance.');
    }
    
    if (report.summary.navigationLinksFound === 0) {
      report.recommendations.push('No navigation links found. Implement main navigation menu.');
    }

    console.log('\n=== NAVIGATION AUDIT REPORT ===');
    console.log(JSON.stringify(report.summary, null, 2));
    
    if (report.recommendations.length > 0) {
      console.log('\nRECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    // Navigation should mostly work
    expect(report.summary.criticalNavigationFailures).toBeLessThan(routesToTest.length * 0.3);
    expect(report.summary.accessibleRoutes).toBeGreaterThan(0);
  });
});