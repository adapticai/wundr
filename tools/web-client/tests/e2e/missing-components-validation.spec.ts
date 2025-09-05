import { test, expect } from '@playwright/test';
import { TestUtilities } from './helpers/test-utilities';
import { TEST_CONFIG } from './helpers/test-config';

/**
 * Missing Components Validation
 * Detects missing UI components, failed renders, and broken component trees
 */

test.describe('Missing Components Validation', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
  });

  test('should validate essential page structure components', async ({ page }) => {
    const routes = TEST_CONFIG.routes.webClient.slice(0, 10);
    const missingComponentsByRoute: Record<string, string[]> = {};

    const essentialComponents = {
      'Layout Components': [
        'header, [role="banner"]',
        'nav, [role="navigation"]', 
        'main, [role="main"]',
        'footer, [role="contentinfo"]'
      ],
      'Interactive Elements': [
        'button',
        'a[href]',
        'input, textarea, select'
      ],
      'Content Structure': [
        'h1, h2, h3, h4, h5, h6',
        'p, div, section, article'
      ]
    };

    for (const route of routes) {
      try {
        await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`);
        await page.waitForLoadState('networkidle');
        
        const missingComponents: string[] = [];

        for (const [category, selectors] of Object.entries(essentialComponents)) {
          for (const selector of selectors) {
            const count = await page.locator(selector).count();
            if (count === 0) {
              missingComponents.push(`${category}: ${selector}`);
            }
          }
        }

        if (missingComponents.length > 0) {
          missingComponentsByRoute[route] = missingComponents;
        }

      } catch (error) {
        missingComponentsByRoute[route] = [`Navigation Error: ${error}`];
      }
    }

    // Report missing components
    Object.entries(missingComponentsByRoute).forEach(([route, missing]) => {
      console.log(`\nMissing components on ${route}:`);
      missing.forEach((component, index) => {
        console.log(`  ${index + 1}. ${component}`);
      });
    });

    // Most routes should have essential components
    const routesWithIssues = Object.keys(missingComponentsByRoute).length;
    expect(routesWithIssues).toBeLessThan(routes.length * 0.4); // Less than 40% with issues
  });

  test('should detect React component rendering failures', async ({ page }) => {
    const componentErrors: string[] = [];
    const renderingFailures: string[] = [];

    // Monitor for React error boundaries or failed renders
    page.on('console', (msg) => {
      if (msg.type() === 'error' && 
          (msg.text().includes('React') || 
           msg.text().includes('component') ||
           msg.text().includes('render'))) {
        componentErrors.push(`Component Error: ${msg.text()}`);
      }
    });

    // Test component-heavy routes
    const componentRoutes = [
      '/dashboard/analysis',
      '/dashboard/visualizations', 
      '/dashboard/performance',
      '/dashboard/reports'
    ];

    for (const route of componentRoutes) {
      await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`);
      await page.waitForTimeout(2000); // Wait for component mounting
      
      // Check for error boundary messages
      const errorBoundaryText = await page.locator('text=/error boundary|something went wrong|failed to render/i').count();
      if (errorBoundaryText > 0) {
        renderingFailures.push(`Error boundary detected on ${route}`);
      }

      // Check for empty/broken component containers
      const emptyContainers = await page.locator('[class*="error"], [class*="empty"], .component-error').count();
      if (emptyContainers > 0) {
        const emptyTexts = await page.locator('[class*="error"], [class*="empty"], .component-error').allTextContents();
        renderingFailures.push(`Empty containers on ${route}: ${emptyTexts.join(', ')}`);
      }
    }

    if (componentErrors.length > 0) {
      console.log('Component Errors:', componentErrors);
    }
    
    if (renderingFailures.length > 0) {
      console.log('Rendering Failures:', renderingFailures);
    }

    expect(componentErrors.length + renderingFailures.length).toBeLessThan(5);
  });

  test('should validate dashboard-specific components', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard`);
    
    const dashboardComponents = {
      'Charts & Visualizations': [
        'canvas', 
        'svg',
        '.recharts-wrapper',
        '.chart-container',
        '.visualization'
      ],
      'Data Display': [
        'table',
        '.data-table',
        '.summary-card',
        '.metric-card',
        '.stats-card'
      ],
      'Navigation & Controls': [
        '.sidebar',
        '.nav-menu',
        '.tab-list',
        '[role="tab"]',
        '.dropdown'
      ]
    };

    const missingDashboardComponents: string[] = [];
    const foundComponents: string[] = [];

    for (const [category, selectors] of Object.entries(dashboardComponents)) {
      let categoryFound = false;
      
      for (const selector of selectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          foundComponents.push(`${category}: ${selector} (${count})`);
          categoryFound = true;
          break; // Found at least one component in this category
        }
      }
      
      if (!categoryFound) {
        missingDashboardComponents.push(category);
      }
    }

    console.log('Found Dashboard Components:', foundComponents);
    
    if (missingDashboardComponents.length > 0) {
      console.log('Missing Dashboard Component Categories:', missingDashboardComponents);
    }

    // Should have most dashboard component categories
    expect(missingDashboardComponents.length).toBeLessThan(Object.keys(dashboardComponents).length * 0.5);
  });

  test('should check for missing images and media', async ({ page }) => {
    const routes = ['/dashboard', '/dashboard/about', '/dashboard/logos'];
    const mediaIssues: Record<string, string[]> = {};

    for (const route of routes) {
      await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`);
      await page.waitForTimeout(1000);
      
      const routeIssues: string[] = [];

      // Check for broken images
      const images = await page.locator('img').all();
      for (const img of images) {
        const src = await img.getAttribute('src');
        const alt = await img.getAttribute('alt');
        
        // Check for missing src
        if (!src || src === '' || src === '#') {
          routeIssues.push(`Image with missing src: ${alt || 'no alt text'}`);
        }
        
        // Check for missing alt text
        if (!alt) {
          routeIssues.push(`Image missing alt text: ${src}`);
        }
      }

      // Check for broken background images (CSS)
      const elementsWithBg = await page.locator('[style*="background-image"]').all();
      for (const element of elementsWithBg) {
        const style = await element.getAttribute('style');
        if (style && style.includes('url(') && !style.includes('data:')) {
          // Could check if background image loads, but complex to implement
          console.log(`Background image found: ${style.substring(0, 100)}...`);
        }
      }

      // Check for missing icons
      const iconElements = await page.locator('[class*="icon"], .lucide, svg[class]').count();
      if (iconElements === 0) {
        routeIssues.push('No icon elements found');
      }

      if (routeIssues.length > 0) {
        mediaIssues[route] = routeIssues;
      }
    }

    Object.entries(mediaIssues).forEach(([route, issues]) => {
      console.log(`\nMedia issues on ${route}:`);
      issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    });

    // Should have minimal media issues
    const totalIssues = Object.values(mediaIssues).flat().length;
    expect(totalIssues).toBeLessThan(10);
  });

  test('should validate form components and inputs', async ({ page }) => {
    const routes = ['/dashboard/settings', '/dashboard/upload', '/dashboard/scripts'];
    const formIssues: Record<string, string[]> = {};

    for (const route of routes) {
      try {
        await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`);
        await page.waitForTimeout(1000);
        
        const routeIssues: string[] = [];
        
        // Check for forms
        const forms = await page.locator('form').all();
        
        for (const form of forms) {
          // Check for inputs without labels
          const inputs = await form.locator('input, textarea, select').all();
          
          for (const input of inputs) {
            const type = await input.getAttribute('type');
            const id = await input.getAttribute('id');
            const ariaLabel = await input.getAttribute('aria-label');
            const placeholder = await input.getAttribute('placeholder');
            
            // Skip hidden inputs
            if (type === 'hidden') continue;
            
            // Check for proper labeling
            let hasLabel = false;
            if (id) {
              const label = await page.locator(`label[for="${id}"]`).count();
              hasLabel = label > 0;
            }
            
            if (!hasLabel && !ariaLabel && !placeholder) {
              routeIssues.push(`Input without proper labeling: type="${type}"`);
            }
          }

          // Check for submit buttons
          const submitButtons = await form.locator('button[type="submit"], input[type="submit"]').count();
          if (submitButtons === 0) {
            routeIssues.push('Form without submit button');
          }
        }

        if (routeIssues.length > 0) {
          formIssues[route] = routeIssues;
        }

      } catch (error) {
        formIssues[route] = [`Route error: ${error}`];
      }
    }

    Object.entries(formIssues).forEach(([route, issues]) => {
      console.log(`\nForm issues on ${route}:`);
      issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    });

    // Form validation should be thorough but allow for different implementations
    const totalFormIssues = Object.values(formIssues).flat().length;
    expect(totalFormIssues).toBeLessThan(15);
  });

  test('should check for loading states and skeleton components', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard/analysis`);
    
    // Quickly check for loading indicators
    const loadingStates = await page.locator('.loading, .spinner, .skeleton, [aria-busy="true"], .loader').count();
    
    // Navigate to a data-heavy route and check for loading states
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard/performance`);
    await page.waitForTimeout(100); // Catch loading state quickly
    
    const loadingStatesPerf = await page.locator('.loading, .spinner, .skeleton, [aria-busy="true"], .loader').count();
    
    console.log(`Loading indicators found: Analysis (${loadingStates}), Performance (${loadingStatesPerf})`);
    
    // It's good to have loading states, but not required
    const totalLoadingStates = loadingStates + loadingStatesPerf;
    
    // Wait for content to load
    await page.waitForTimeout(3000);
    
    // Check that loading states are replaced with content
    const persistentLoading = await page.locator('.loading, .spinner, [aria-busy="true"]').count();
    
    if (persistentLoading > 0) {
      console.log('Warning: Persistent loading indicators found, possible stuck loading states');
    }
    
    // Loading states should not persist indefinitely
    expect(persistentLoading).toBeLessThan(3);
  });

  test('should validate accessibility components and ARIA attributes', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}/dashboard`);
    
    const accessibilityIssues: string[] = [];
    
    // Check for buttons without accessible names
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const ariaLabelledBy = await button.getAttribute('aria-labelledby');
      
      if (!text?.trim() && !ariaLabel && !ariaLabelledBy) {
        accessibilityIssues.push('Button without accessible name found');
      }
    }

    // Check for images without alt text
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      const role = await img.getAttribute('role');
      
      if (!alt && !ariaLabel && role !== 'presentation') {
        accessibilityIssues.push('Image without alt text found');
      }
    }

    // Check for form inputs without labels
    const inputs = await page.locator('input:not([type="hidden"]), textarea, select').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      let hasLabel = false;
      if (id) {
        const label = await page.locator(`label[for="${id}"]`).count();
        hasLabel = label > 0;
      }
      
      if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
        accessibilityIssues.push('Input without proper labeling found');
      }
    }

    // Check for heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
    console.log(`Heading structure: ${headings.length} headings found`);
    
    if (headings.length === 0) {
      accessibilityIssues.push('No headings found on page');
    }

    if (accessibilityIssues.length > 0) {
      console.log('Accessibility Issues:', accessibilityIssues);
    }

    // Allow some accessibility issues but flag major problems
    expect(accessibilityIssues.length).toBeLessThan(10);
  });

  test('should generate missing components report', async ({ page }) => {
    const report = {
      timestamp: new Date().toISOString(),
      dashboard: 'Web Client Dashboard',
      summary: {
        routesTested: 0,
        totalIssuesFound: 0,
        criticalMissing: 0,
        accessibilityIssues: 0,
        mediaIssues: 0
      },
      details: {
        missingByRoute: {} as Record<string, string[]>,
        criticalComponents: [] as string[],
        recommendations: [] as string[]
      }
    };

    const routesToTest = TEST_CONFIG.routes.webClient.slice(0, 6);
    report.summary.routesTested = routesToTest.length;

    const criticalComponents = ['main', 'nav', 'button', 'a[href]'];

    for (const route of routesToTest) {
      try {
        await page.goto(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`);
        await page.waitForTimeout(1000);

        const routeIssues: string[] = [];

        // Check critical components
        for (const component of criticalComponents) {
          const count = await page.locator(component).count();
          if (count === 0) {
            routeIssues.push(`Missing critical: ${component}`);
            report.details.criticalComponents.push(`${route}: ${component}`);
            report.summary.criticalMissing++;
          }
        }

        // Check for accessibility issues
        const missingAltImages = await page.locator('img:not([alt])').count();
        if (missingAltImages > 0) {
          routeIssues.push(`${missingAltImages} images without alt text`);
          report.summary.accessibilityIssues += missingAltImages;
        }

        if (routeIssues.length > 0) {
          report.details.missingByRoute[route] = routeIssues;
        }

      } catch (error) {
        report.details.missingByRoute[route] = [`Navigation error: ${error}`];
      }
    }

    report.summary.totalIssuesFound = Object.values(report.details.missingByRoute).flat().length;

    // Generate recommendations
    if (report.summary.criticalMissing > 0) {
      report.details.recommendations.push('Critical components missing. Review component rendering and routing.');
    }
    
    if (report.summary.accessibilityIssues > 5) {
      report.details.recommendations.push('Multiple accessibility issues found. Add alt text and proper labeling.');
    }
    
    if (report.summary.totalIssuesFound > 20) {
      report.details.recommendations.push('High number of component issues. Consider comprehensive component audit.');
    }

    console.log('\n=== MISSING COMPONENTS REPORT ===');
    console.log(JSON.stringify(report.summary, null, 2));
    
    if (report.details.recommendations.length > 0) {
      console.log('\nRECOMMENDATIONS:');
      report.details.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    // Critical components should not be missing
    expect(report.summary.criticalMissing).toBeLessThan(5);
    expect(report.summary.totalIssuesFound).toBeLessThan(30);
  });
});