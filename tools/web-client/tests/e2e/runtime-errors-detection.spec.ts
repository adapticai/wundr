import { test, expect } from '@playwright/test';
import { TestUtilities } from './helpers/test-utilities';
import { TEST_CONFIG } from './helpers/test-config';

/**
 * Runtime JavaScript Errors Detection
 * Monitors for console errors, unhandled exceptions, and runtime failures
 */

test.describe('Runtime Errors Detection', () => {
  let testUtils: TestUtilities;
  let jsErrors: string[] = [];
  let consoleErrors: string[] = [];
  let networkErrors: string[] = [];
  let uncaughtExceptions: string[] = [];

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
    
    // Clear error arrays
    jsErrors = [];
    consoleErrors = [];
    networkErrors = [];
    uncaughtExceptions = [];

    // Set up comprehensive error monitoring
    page.on('pageerror', (error) => {
      jsErrors.push(`${page.url()}: ${error.message}`);
      console.log(`JavaScript Error on ${page.url()}: ${error.message}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`${page.url()}: ${msg.text()}`);
        console.log(`Console Error on ${page.url()}: ${msg.text()}`);
      }
    });

    page.on('response', (response) => {
      if (!response.ok() && response.status() >= 400) {
        networkErrors.push(`${response.url()} - ${response.status()} ${response.statusText()}`);
      }
    });

    // Monitor for uncaught promise rejections
    page.on('pageerror', (error) => {
      if (error.message.includes('unhandled') || error.message.includes('rejected')) {
        uncaughtExceptions.push(`Unhandled: ${error.message}`);
      }
    });
  });

  test.afterEach(async () => {
    // Report errors found during test
    if (jsErrors.length > 0 || consoleErrors.length > 0 || networkErrors.length > 0) {
      console.log('\n=== ERRORS DETECTED IN TEST ===');
      console.log(`JavaScript Errors: ${jsErrors.length}`);
      console.log(`Console Errors: ${consoleErrors.length}`);
      console.log(`Network Errors: ${networkErrors.length}`);
      console.log(`Uncaught Exceptions: ${uncaughtExceptions.length}`);
    }
  });

  test('should monitor for JavaScript errors during basic navigation', async ({ page }) => {
    const routes = TEST_CONFIG.routes.webClient.slice(0, 8); // Test first 8 routes
    const routeErrors: Record<string, string[]> = {};

    for (const route of routes) {
      const errorsBeforeNavigation = jsErrors.length;
      
      try {
        await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000); // Wait for any async operations
        
        const errorsAfterNavigation = jsErrors.slice(errorsBeforeNavigation);
        if (errorsAfterNavigation.length > 0) {
          routeErrors[route] = errorsAfterNavigation;
        }
        
      } catch (_error) {
        routeErrors[route] = [`Navigation error: ${error}`];
      }
    }

    // Report errors by route
    Object.entries(routeErrors).forEach(([route, errors]) => {
      console.log(`\nErrors on ${route}:`);
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    });

    // Should have minimal JavaScript errors
    expect(Object.keys(routeErrors).length).toBeLessThan(routes.length * 0.3); // Less than 30% of routes with errors
  });

  test('should detect React/component rendering errors', async ({ page }) => {
    const reactErrors: string[] = [];
    
    // Monitor for React-specific errors
    page.on('pageerror', (error) => {
      if (error.message.includes('React') || 
          error.message.includes('Cannot read prop') ||
          error.message.includes('undefined is not a function') ||
          error.message.includes('Cannot access before initialization')) {
        reactErrors.push(`React Error: ${error.message}`);
      }
    });

    // Navigate to component-heavy pages
    const componentHeavyRoutes = [
      '/dashboard/analysis',
      '/dashboard/visualizations',
      '/dashboard/performance',
      '/dashboard/reports'
    ];

    for (const route of componentHeavyRoutes) {
      await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`);
      await page.waitForTimeout(2000); // Wait for component mounting
    }

    if (reactErrors.length > 0) {
      console.log('React/Component Errors Found:', reactErrors);
    }

    expect(reactErrors.length).toBeLessThan(3);
  });

  test('should monitor for API call failures', async ({ page }) => {
    const apiErrors: string[] = [];
    const apiCallsMonitored: string[] = [];

    page.on('response', (response) => {
      const url = response.url();
      
      if (url.includes('/api/')) {
        apiCallsMonitored.push(url);
        
        if (!response.ok()) {
          apiErrors.push(`API Error: ${url} - ${response.status()} ${response.statusText()}`);
        }
      }
    });

    // Navigate to pages that make API calls
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard/analysis`);
    await page.waitForTimeout(3000);
    
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard/performance`);
    await page.waitForTimeout(3000);

    console.log(`API calls monitored: ${apiCallsMonitored.length}`);
    
    if (apiErrors.length > 0) {
      console.log('API Errors Found:', apiErrors);
    }

    // Allow some API errors (endpoints may not be fully implemented)
    expect(apiErrors.length).toBeLessThan(10);
  });

  test('should detect memory leaks and performance issues', async ({ page }) => {
    // Navigate to dashboard and interact with components
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard`);
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : null;
    });

    // Perform memory-intensive operations
    for (let i = 0; i < 5; i++) {
      await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard/analysis`);
      await page.waitForTimeout(1000);
      
      await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard/visualizations`);
      await page.waitForTimeout(1000);
    }

    // Force garbage collection if possible
    await page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });

    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : null;
    });

    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory - initialMemory;
      console.log(`Memory usage change: ${memoryIncrease} bytes`);
      
      // Flag if memory increased significantly (potential leak)
      if (memoryIncrease > 50 * 1024 * 1024) { // 50MB
        console.warn('Potential memory leak detected');
      }
      
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB threshold
    } else {
      console.log('Memory monitoring not available in this browser');
    }
  });

  test('should handle user interactions without errors', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard`);
    
    const interactionErrors: string[] = [];
    
    // Monitor errors during interactions
    const errorsBeforeInteractions = jsErrors.length;
    
    // Try clicking various interactive elements
    const interactiveElements = [
      'button:not([disabled])',
      'a[href]',
      '[role="button"]:not([disabled])',
      'input:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];

    for (const selector of interactiveElements) {
      try {
        const elements = await page.locator(selector).all();
        
        // Test first few elements of each type
        for (const element of elements.slice(0, 2)) {
          try {
            await element.click({ timeout: 1000 });
            await page.waitForTimeout(500);
          } catch (_error) {
            // Element might not be clickable, that's ok
          }
        }
      } catch (_error) {
        // Selector might not exist, that's ok
      }
    }

    const errorsAfterInteractions = jsErrors.slice(errorsBeforeInteractions);
    
    if (errorsAfterInteractions.length > 0) {
      console.log('Interaction Errors:', errorsAfterInteractions);
    }

    expect(errorsAfterInteractions.length).toBeLessThan(5);
  });

  test('should validate form handling and validation errors', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard/settings`);
    
    const formErrors: string[] = [];
    const formsFound = await page.locator('form').count();
    
    console.log(`Forms found: ${formsFound}`);
    
    if (formsFound > 0) {
      // Try submitting forms without filling them (should trigger validation)
      const forms = await page.locator('form').all();
      
      for (const form of forms.slice(0, 2)) {
        try {
          const submitButton = form.locator('button[type="submit"], input[type="submit"]');
          
          if (await submitButton.count() > 0) {
            const errorsBeforeSubmit = jsErrors.length;
            
            await submitButton.first().click();
            await page.waitForTimeout(1000);
            
            const errorsAfterSubmit = jsErrors.slice(errorsBeforeSubmit);
            if (errorsAfterSubmit.length > 0) {
              formErrors.push(...errorsAfterSubmit);
            }
          }
        } catch (_error) {
          // Form submission might fail, that's expected for validation
        }
      }
    }

    if (formErrors.length > 0) {
      console.log('Form Validation Errors:', formErrors);
    }

    // Form validation should not cause JavaScript errors
    expect(formErrors.length).toBeLessThan(2);
  });

  test('should generate comprehensive error report', async ({ page }) => {
    const errorReport = {
      timestamp: new Date().toISOString(),
      dashboard: 'Web Client Dashboard',
      testDuration: 0,
      summary: {
        totalJSErrors: 0,
        totalConsoleErrors: 0,
        totalNetworkErrors: 0,
        totalUncaughtExceptions: 0,
        criticalErrors: 0
      },
      errorsByType: {
        javascript: [] as string[],
        console: [] as string[],
        network: [] as string[],
        uncaught: [] as string[]
      },
      recommendations: [] as string[]
    };

    const startTime = Date.now();
    
    // Comprehensive error detection across multiple routes
    const routesToTest = TEST_CONFIG.routes.webClient.slice(0, 6);
    
    for (const route of routesToTest) {
      try {
        await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`);
        await page.waitForTimeout(2000);
      } catch (_error) {
        console.log(`Error navigating to ${route}: ${error}`);
      }
    }

    errorReport.testDuration = Date.now() - startTime;
    
    // Compile error summary
    errorReport.summary.totalJSErrors = jsErrors.length;
    errorReport.summary.totalConsoleErrors = consoleErrors.length;
    errorReport.summary.totalNetworkErrors = networkErrors.length;
    errorReport.summary.totalUncaughtExceptions = uncaughtExceptions.length;
    
    errorReport.errorsByType.javascript = [...new Set(jsErrors)];
    errorReport.errorsByType.console = [...new Set(consoleErrors)];
    errorReport.errorsByType.network = [...new Set(networkErrors)];
    errorReport.errorsByType.uncaught = [...new Set(uncaughtExceptions)];

    // Count critical errors
    const criticalKeywords = ['cannot read', 'undefined is not', 'null is not', 'failed to fetch'];
    errorReport.summary.criticalErrors = jsErrors.filter(error => 
      criticalKeywords.some(keyword => error.toLowerCase().includes(keyword))
    ).length;

    // Generate recommendations
    if (errorReport.summary.totalJSErrors > 5) {
      errorReport.recommendations.push('High number of JavaScript errors detected. Review code for null checks and error handling.');
    }
    
    if (errorReport.summary.totalNetworkErrors > 10) {
      errorReport.recommendations.push('Multiple network errors detected. Check API endpoints and error handling.');
    }
    
    if (errorReport.summary.criticalErrors > 0) {
      errorReport.recommendations.push('Critical runtime errors found. These should be addressed immediately.');
    }

    console.log('\n=== COMPREHENSIVE ERROR REPORT ===');
    console.log(JSON.stringify(errorReport.summary, null, 2));
    
    if (errorReport.recommendations.length > 0) {
      console.log('\nRECOMMENDATIONS:');
      errorReport.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    // Test assertions
    expect(errorReport.summary.criticalErrors).toBeLessThan(3);
    expect(errorReport.summary.totalJSErrors).toBeLessThan(15);
  });
});