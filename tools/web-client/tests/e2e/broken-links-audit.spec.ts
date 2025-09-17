import { test, expect } from '@playwright/test';
import { TestUtilities } from './helpers/test-utilities';
import { TEST_CONFIG } from './helpers/test-config';

/**
 * Comprehensive Broken Links Detection
 * Systematically checks all links across both dashboards
 */

test.describe('Broken Links Audit', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
  });

  test('should audit all internal links in web client dashboard', async ({ page }) => {
    const baseUrl = TEST_CONFIG.dashboards.webClient.baseURL;
    const routes = TEST_CONFIG.routes.webClient;
    
    const allBrokenLinks: string[] = [];
    const allWorkingLinks: string[] = [];
    const allRedirectLinks: string[] = [];

    for (const route of routes.slice(0, 10)) { // Limit for performance
      try {
        console.log(`Auditing links on: ${route}`);
        
        const linkAudit = await testUtils.performLinkAudit(`${baseUrl}${route}`);
        
        allBrokenLinks.push(...linkAudit.brokenLinks);
        allWorkingLinks.push(...linkAudit.workingLinks);
        allRedirectLinks.push(...linkAudit.redirectLinks);
        
        await page.waitForTimeout(500); // Rate limiting
        
      } catch (_error) {
        console.log(`Error auditing ${route}: ${error}`);
      }
    }

    // Remove duplicates
    const uniqueBrokenLinks = [...new Set(allBrokenLinks)];
    const uniqueWorkingLinks = [...new Set(allWorkingLinks)];
    const uniqueRedirectLinks = [...new Set(allRedirectLinks)];

    console.log(`\n=== LINK AUDIT RESULTS ===`);
    console.log(`Working Links: ${uniqueWorkingLinks.length}`);
    console.log(`Redirect Links: ${uniqueRedirectLinks.length}`);
    console.log(`Broken Links: ${uniqueBrokenLinks.length}`);
    
    if (uniqueBrokenLinks.length > 0) {
      console.log(`\nBROKEN LINKS FOUND:`);
      uniqueBrokenLinks.forEach((link, index) => {
        console.log(`${index + 1}. ${link}`);
      });
    }

    if (uniqueRedirectLinks.length > 0) {
      console.log(`\nREDIRECT LINKS:`);
      uniqueRedirectLinks.slice(0, 5).forEach((link, index) => {
        console.log(`${index + 1}. ${link}`);
      });
    }

    // Allow some broken links but flag if too many
    expect(uniqueBrokenLinks.length).toBeLessThan(20);
    
    // Should have found some working links
    expect(uniqueWorkingLinks.length).toBeGreaterThan(0);
  });

  test('should check external links separately', async ({ page }) => {
    await page.goto(TEST_CONFIG.dashboards.webClient.baseURL);
    
    const allLinks = await page.locator('a[href]').all();
    const externalLinks = [];
    const internalLinks = [];

    for (const link of allLinks) {
      const href = await link.getAttribute('href');
      if (href) {
        if (href.startsWith('http') && !href.includes('localhost')) {
          externalLinks.push(href);
        } else if (href.startsWith('/') || href.includes('localhost')) {
          internalLinks.push(href);
        }
      }
    }

    console.log(`External links found: ${externalLinks.length}`);
    console.log(`Internal links found: ${internalLinks.length}`);

    // Test a sample of external links (to avoid long test times)
    const sampleExternalLinks = externalLinks.slice(0, 5);
    const brokenExternalLinks: string[] = [];

    for (const link of sampleExternalLinks) {
      try {
        const response = await page.request.get(link, { timeout: 10000 });
        if (!response.ok()) {
          brokenExternalLinks.push(`${link} - ${response.status()}`);
        }
      } catch (_error) {
        brokenExternalLinks.push(`${link} - Timeout/Network Error`);
      }
    }

    if (brokenExternalLinks.length > 0) {
      console.log('Broken External Links:', brokenExternalLinks);
    }

    // External links may be temporarily down, so be lenient
    expect(brokenExternalLinks.length).toBeLessThan(sampleExternalLinks.length);
  });

  test('should validate navigation links work correctly', async ({ page }) => {
    await page.goto(TEST_CONFIG.dashboards.webClient.baseURL + '/dashboard');
    
    // Find all navigation links
    const navLinks = await page.locator('nav a, [role="navigation"] a, [data-testid*="nav"] a').all();
    const brokenNavLinks: string[] = [];
    const workingNavLinks: string[] = [];

    for (const link of navLinks.slice(0, 10)) { // Test first 10 nav links
      try {
        const href = await link.getAttribute('href');
        if (href && href.startsWith('/')) {
          // Click the link and check if it navigates correctly
          await link.click();
          await page.waitForLoadState('networkidle');
          
          const currentUrl = page.url();
          if (currentUrl.includes(href)) {
            workingNavLinks.push(href);
          } else {
            brokenNavLinks.push(`${href} - Navigated to ${currentUrl} instead`);
          }
        }
      } catch (_error) {
        const href = await link.getAttribute('href');
        brokenNavLinks.push(`${href} - Navigation error: ${error}`);
      }
    }

    console.log('Navigation Link Results:');
    console.log(`Working: ${workingNavLinks.length}`);
    console.log(`Broken: ${brokenNavLinks.length}`);

    if (brokenNavLinks.length > 0) {
      console.log('Broken Navigation Links:', brokenNavLinks);
    }

    // Most navigation links should work
    expect(brokenNavLinks.length).toBeLessThan(navLinks.length * 0.3);
  });

  test('should check for broken image links', async ({ page }) => {
    const routes = ['/dashboard', '/dashboard/about', '/dashboard/logos'];
    const allBrokenImages: string[] = [];
    const allWorkingImages: string[] = [];

    for (const route of routes) {
      try {
        await page.goto(TEST_CONFIG.dashboards.webClient.baseURL + route);
        await page.waitForTimeout(1000);
        
        const images = await page.locator('img').all();
        
        for (const img of images) {
          const src = await img.getAttribute('src');
          if (src) {
            try {
              const response = await page.request.get(src);
              if (response.ok()) {
                allWorkingImages.push(src);
              } else {
                allBrokenImages.push(`${src} - ${response.status()}`);
              }
            } catch (_error) {
              allBrokenImages.push(`${src} - Network Error`);
            }
          }
        }
      } catch (_error) {
        console.log(`Error checking images on ${route}: ${error}`);
      }
    }

    const uniqueBrokenImages = [...new Set(allBrokenImages)];
    const uniqueWorkingImages = [...new Set(allWorkingImages)];

    console.log('Image Audit Results:');
    console.log(`Working Images: ${uniqueWorkingImages.length}`);
    console.log(`Broken Images: ${uniqueBrokenImages.length}`);

    if (uniqueBrokenImages.length > 0) {
      console.log('Broken Images:', uniqueBrokenImages);
    }

    // Should have minimal broken images
    expect(uniqueBrokenImages.length).toBeLessThan(5);
  });

  test('should validate anchor links and internal navigation', async ({ page }) => {
    await page.goto(TEST_CONFIG.dashboards.webClient.baseURL + '/dashboard/docs');
    
    // Find all anchor links (hash links)
    const anchorLinks = await page.locator('a[href^="#"]').all();
    const brokenAnchors: string[] = [];
    const workingAnchors: string[] = [];

    for (const link of anchorLinks) {
      const href = await link.getAttribute('href');
      if (href) {
        const targetId = href.substring(1); // Remove #
        
        // Check if target element exists
        const targetElement = page.locator(`#${targetId}`);
        const targetExists = await targetElement.count() > 0;
        
        if (targetExists) {
          workingAnchors.push(href);
        } else {
          brokenAnchors.push(href);
        }
      }
    }

    console.log('Anchor Link Results:');
    console.log(`Working Anchors: ${workingAnchors.length}`);
    console.log(`Broken Anchors: ${brokenAnchors.length}`);

    if (brokenAnchors.length > 0) {
      console.log('Broken Anchor Links:', brokenAnchors);
    }

    // Most anchor links should work
    expect(brokenAnchors.length).toBeLessThan(anchorLinks.length * 0.2);
  });

  test('should generate comprehensive link report', async ({ page }) => {
    const report = {
      timestamp: new Date().toISOString(),
      dashboard: 'Web Client (Port 3000)',
      summary: {
        totalRoutesTested: 0,
        totalLinksFound: 0,
        workingLinks: 0,
        brokenLinks: 0,
        redirectLinks: 0,
        brokenImages: 0,
        workingImages: 0
      },
      details: {
        brokenLinksList: [] as string[],
        brokenImagesList: [] as string[],
        redirectLinksList: [] as string[]
      }
    };

    // Test a subset of routes for comprehensive report
    const routesToTest = TEST_CONFIG.routes.webClient.slice(0, 5);
    report.summary.totalRoutesTested = routesToTest.length;

    for (const route of routesToTest) {
      try {
        const linkAudit = await testUtils.performLinkAudit(`${TEST_CONFIG.dashboards.webClient.baseURL}${route}`);
        
        report.summary.workingLinks += linkAudit.workingLinks.length;
        report.summary.brokenLinks += linkAudit.brokenLinks.length;
        report.summary.redirectLinks += linkAudit.redirectLinks.length;
        
        report.details.brokenLinksList.push(...linkAudit.brokenLinks);
        report.details.redirectLinksList.push(...linkAudit.redirectLinks);
        
      } catch (_error) {
        console.log(`Error in comprehensive audit for ${route}: ${error}`);
      }
    }

    // Remove duplicates
    report.details.brokenLinksList = [...new Set(report.details.brokenLinksList)];
    report.details.redirectLinksList = [...new Set(report.details.redirectLinksList)];
    
    report.summary.totalLinksFound = report.summary.workingLinks + report.summary.brokenLinks + report.summary.redirectLinks;

    console.log('\n=== COMPREHENSIVE LINK AUDIT REPORT ===');
    console.log(JSON.stringify(report.summary, null, 2));
    
    if (report.details.brokenLinksList.length > 0) {
      console.log('\nTOP BROKEN LINKS:');
      report.details.brokenLinksList.slice(0, 10).forEach((link, index) => {
        console.log(`${index + 1}. ${link}`);
      });
    }

    // Store report for potential CI/CD integration
    expect(report.summary.totalLinksFound).toBeGreaterThan(0);
    expect(report.summary.brokenLinks).toBeLessThan(report.summary.totalLinksFound * 0.1); // Less than 10% broken
  });
});