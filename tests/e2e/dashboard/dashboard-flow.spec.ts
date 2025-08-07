import { test, expect, Page } from '@playwright/test';
import path from 'path';

test.describe('Wundr Dashboard E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/dashboard');
  });

  test.describe('Dashboard Navigation', () => {
    test('should load main dashboard', async () => {
      await expect(page).toHaveTitle(/Wundr Dashboard/);
      await expect(page.locator('h1')).toContainText('Dashboard');
    });

    test('should navigate to analysis section', async () => {
      await page.click('text=Analysis');
      await expect(page).toHaveURL(/.*\/dashboard\/analysis/);
      await expect(page.locator('h2')).toContainText('Code Analysis');
    });

    test('should navigate to reports section', async () => {
      await page.click('text=Reports');
      await expect(page).toHaveURL(/.*\/dashboard\/reports/);
      await expect(page.locator('h2')).toContainText('Reports');
    });

    test('should navigate to settings', async () => {
      await page.click('text=Settings');
      await expect(page).toHaveURL(/.*\/dashboard\/settings/);
      await expect(page.locator('h2')).toContainText('Settings');
    });
  });

  test.describe('File Upload and Analysis', () => {
    test('should upload and analyze project files', async () => {
      await page.goto('/dashboard/upload');
      
      // Create test file for upload
      const testFilePath = path.join(__dirname, '../fixtures/test-project.zip');
      
      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);
      
      // Submit upload
      await page.click('button:has-text("Upload")');
      
      // Wait for upload to complete
      await expect(page.locator('.upload-success')).toBeVisible({ timeout: 30000 });
      
      // Navigate to analysis
      await page.click('text=Analyze Now');
      
      // Wait for analysis to complete
      await expect(page.locator('.analysis-results')).toBeVisible({ timeout: 60000 });
      
      // Verify analysis results
      await expect(page.locator('.files-analyzed')).toContainText(/\d+ files analyzed/);
      await expect(page.locator('.issues-found')).toContainText(/\d+ issues found/);
    });

    test('should handle upload errors gracefully', async () => {
      await page.goto('/dashboard/upload');
      
      // Try to upload invalid file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, '../fixtures/invalid-file.txt'));
      
      await page.click('button:has-text("Upload")');
      
      // Verify error message
      await expect(page.locator('.upload-error')).toBeVisible();
      await expect(page.locator('.upload-error')).toContainText('Invalid file type');
    });

    test('should show upload progress', async () => {
      await page.goto('/dashboard/upload');
      
      const testFilePath = path.join(__dirname, '../fixtures/large-project.zip');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);
      
      await page.click('button:has-text("Upload")');
      
      // Verify progress bar appears
      await expect(page.locator('.progress-bar')).toBeVisible();
      await expect(page.locator('.progress-percentage')).toContainText(/%$/);
    });
  });

  test.describe('Analysis Dashboard', () => {
    test('should display analysis overview', async () => {
      await page.goto('/dashboard/analysis');
      
      // Verify key metrics are displayed
      await expect(page.locator('.metric-card')).toHaveCount(4);
      await expect(page.locator('[data-testid="files-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="issues-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="duplicates-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="circular-deps-count"]')).toBeVisible();
    });

    test('should filter analysis results', async () => {
      await page.goto('/dashboard/analysis');
      
      // Apply severity filter
      await page.selectOption('select[name="severity"]', 'high');
      await page.click('button:has-text("Apply Filter")');
      
      // Verify filtered results
      await expect(page.locator('.issue-item')).toHaveCount(0); // Assuming no high severity issues in test data
      
      // Clear filter
      await page.selectOption('select[name="severity"]', 'all');
      await page.click('button:has-text("Apply Filter")');
      
      await expect(page.locator('.issue-item').first()).toBeVisible();
    });

    test('should drill down into specific issues', async () => {
      await page.goto('/dashboard/analysis');
      
      // Click on first issue
      await page.click('.issue-item:first-child .issue-title');
      
      // Verify issue details modal opens
      await expect(page.locator('.issue-modal')).toBeVisible();
      await expect(page.locator('.issue-description')).toBeVisible();
      await expect(page.locator('.issue-location')).toBeVisible();
      await expect(page.locator('.issue-suggestions')).toBeVisible();
      
      // Close modal
      await page.click('.modal-close');
      await expect(page.locator('.issue-modal')).not.toBeVisible();
    });
  });

  test.describe('Visualization Components', () => {
    test('should display dependency graph', async () => {
      await page.goto('/dashboard/analysis/dependencies');
      
      // Wait for graph to load
      await expect(page.locator('.dependency-graph')).toBeVisible({ timeout: 10000 });
      
      // Verify graph elements
      await expect(page.locator('.node')).toHaveCount.greaterThan(0);
      await expect(page.locator('.edge')).toHaveCount.greaterThan(0);
      
      // Test graph interaction
      await page.click('.node:first-child');
      await expect(page.locator('.node-details')).toBeVisible();
    });

    test('should display duplicate code visualization', async () => {
      await page.goto('/dashboard/analysis/duplicates');
      
      // Verify duplicate blocks are shown
      await expect(page.locator('.duplicate-group')).toHaveCount.greaterThan(0);
      
      // Test expandable duplicate groups
      await page.click('.duplicate-group:first-child .expand-button');
      await expect(page.locator('.duplicate-instances')).toBeVisible();
      
      // Verify code highlighting
      await expect(page.locator('.code-block .highlight')).toHaveCount.greaterThan(0);
    });

    test('should display circular dependency diagram', async () => {
      await page.goto('/dashboard/analysis/circular');
      
      // Wait for circular dependency diagram
      await expect(page.locator('.circular-diagram')).toBeVisible({ timeout: 10000 });
      
      // Verify circular paths are highlighted
      await expect(page.locator('.circular-path')).toHaveCount.greaterThan(0);
      
      // Test path highlighting on hover
      await page.hover('.circular-path:first-child');
      await expect(page.locator('.path-highlight')).toBeVisible();
    });
  });

  test.describe('Report Generation', () => {
    test('should generate comprehensive report', async () => {
      await page.goto('/dashboard/reports');
      
      // Configure report options
      await page.check('input[name="include-duplicates"]');
      await page.check('input[name="include-dependencies"]');
      await page.check('input[name="include-metrics"]');
      
      // Set report format
      await page.selectOption('select[name="format"]', 'json');
      
      // Generate report
      await page.click('button:has-text("Generate Report")');
      
      // Wait for report generation
      await expect(page.locator('.report-status')).toContainText('Generating report...');
      await expect(page.locator('.report-complete')).toBeVisible({ timeout: 30000 });
      
      // Verify download link
      await expect(page.locator('.download-link')).toBeVisible();
    });

    test('should schedule recurring reports', async () => {
      await page.goto('/dashboard/reports');
      
      await page.click('tab:has-text("Schedule")');
      
      // Configure recurring report
      await page.selectOption('select[name="frequency"]', 'weekly');
      await page.fill('input[name="email"]', 'test@example.com');
      
      await page.click('button:has-text("Schedule Report")');
      
      // Verify confirmation
      await expect(page.locator('.schedule-success')).toContainText('Report scheduled successfully');
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('should load dashboard within performance budget', async () => {
      const startTime = Date.now();
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('should be accessible with keyboard navigation', async () => {
      await page.goto('/dashboard');
      
      // Test tab navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Navigate through main menu
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
      }
      
      // Test Enter key activation
      await page.keyboard.press('Enter');
      
      // Verify navigation occurred
      await expect(page).not.toHaveURL('/dashboard');
    });

    test('should support screen reader attributes', async () => {
      await page.goto('/dashboard');
      
      // Verify ARIA attributes
      await expect(page.locator('[role="main"]')).toBeVisible();
      await expect(page.locator('[aria-label]')).toHaveCount.greaterThan(0);
      
      // Verify headings structure
      const h1Count = await page.locator('h1').count();
      const h2Count = await page.locator('h2').count();
      
      expect(h1Count).toBe(1); // Should have only one H1
      expect(h2Count).toBeGreaterThan(0); // Should have H2 sections
    });

    test('should be responsive across device sizes', async () => {
      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');
      
      // Verify mobile navigation
      await expect(page.locator('.mobile-menu-button')).toBeVisible();
      
      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      
      // Verify tablet layout
      await expect(page.locator('.tablet-layout')).toBeVisible();
      
      // Test desktop view
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();
      
      // Verify desktop layout
      await expect(page.locator('.desktop-layout')).toBeVisible();
    });
  });

  test.describe('Real-time Features', () => {
    test('should update analysis status in real-time', async () => {
      await page.goto('/dashboard/analysis');
      
      // Start analysis
      await page.click('button:has-text("Start Analysis")');
      
      // Verify real-time status updates
      await expect(page.locator('.analysis-status')).toContainText('Starting...');
      await expect(page.locator('.analysis-status')).toContainText('Processing...', { timeout: 10000 });
      await expect(page.locator('.analysis-status')).toContainText('Complete', { timeout: 60000 });
    });

    test('should handle connection interruptions gracefully', async () => {
      await page.goto('/dashboard/analysis');
      
      // Start analysis
      await page.click('button:has-text("Start Analysis")');
      
      // Simulate network interruption
      await page.context().setOffline(true);
      
      // Verify offline indicator
      await expect(page.locator('.offline-indicator')).toBeVisible();
      
      // Restore connection
      await page.context().setOffline(false);
      
      // Verify reconnection
      await expect(page.locator('.online-indicator')).toBeVisible();
      await expect(page.locator('.sync-indicator')).toContainText('Synced');
    });
  });
});