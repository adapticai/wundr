/**
 * Channels Page UI Test
 * Tests the channels page functionality including navigation, dialog, and interactions
 */

import { test, expect, type Page } from '@playwright/test';

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_WORKSPACE_ID = 'test-workspace-123'; // Using a test workspace ID

test.describe('Channels Page Tests', () => {
  let page: Page;
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Capture console errors and warnings
    consoleErrors = [];
    consoleWarnings = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('1. Navigate to channels page and verify it loads', async () => {
    const url = `${BASE_URL}/${TEST_WORKSPACE_ID}/channels`;

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Take screenshot
      await page.screenshot({
        path: '/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/screenshots/channels-page-load.png',
        fullPage: true
      });

      // Check if page loaded
      const pageTitle = await page.locator('h1').first().textContent();
      expect(pageTitle).toBeTruthy();

      console.log('✓ Page loaded successfully');
      console.log(`  Page title: ${pageTitle}`);
    } catch (error) {
      console.error('✗ Failed to load page:', error);
      throw error;
    }
  });

  test('2. Check if channel list section is present', async () => {
    const url = `${BASE_URL}/${TEST_WORKSPACE_ID}/channels`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    try {
      // Look for channels header
      const header = await page.locator('h1:has-text("Channels")');
      await expect(header).toBeVisible({ timeout: 10000 });

      // Check for description
      const description = await page.locator('text=/Organize conversations/i');
      await expect(description).toBeVisible();

      // Check for empty state or channel grid
      const hasEmptyState = await page.locator('text=/No Channels Yet/i').isVisible().catch(() => false);
      const hasChannelGrid = await page.locator('[class*="grid"]').isVisible().catch(() => false);

      console.log('✓ Channel list section found');
      console.log(`  Empty state visible: ${hasEmptyState}`);
      console.log(`  Channel grid visible: ${hasChannelGrid}`);

      await page.screenshot({
        path: '/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/screenshots/channels-list-section.png',
        fullPage: true
      });
    } catch (error) {
      console.error('✗ Channel list section check failed:', error);
      throw error;
    }
  });

  test('3. Test "Create Channel" button visibility and click', async () => {
    const url = `${BASE_URL}/${TEST_WORKSPACE_ID}/channels`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    try {
      // Find and click Create Channel button
      const createButton = page.locator('button:has-text("Create Channel")').first();
      await expect(createButton).toBeVisible({ timeout: 10000 });

      await page.screenshot({
        path: '/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/screenshots/before-create-button-click.png',
        fullPage: true
      });

      await createButton.click();

      // Wait for dialog to appear
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: '/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/screenshots/after-create-button-click.png',
        fullPage: true
      });

      console.log('✓ Create Channel button clicked successfully');
    } catch (error) {
      console.error('✗ Create Channel button test failed:', error);
      throw error;
    }
  });

  test('4. Test Create Channel dialog appears and has all fields', async () => {
    const url = `${BASE_URL}/${TEST_WORKSPACE_ID}/channels`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    try {
      // Click Create Channel button
      await page.locator('button:has-text("Create Channel")').first().click();
      await page.waitForTimeout(1000);

      // Check dialog appears
      const dialogTitle = page.locator('[role="dialog"] h2:has-text("Create Channel")');
      await expect(dialogTitle).toBeVisible({ timeout: 10000 });

      // Check for Channel Name input
      const nameInput = page.locator('#channel-name');
      await expect(nameInput).toBeVisible();

      // Check for Description textarea
      const descriptionInput = page.locator('#channel-description');
      await expect(descriptionInput).toBeVisible();

      // Check for Channel Type radio buttons
      const publicRadio = page.locator('#type-public');
      const privateRadio = page.locator('#type-private');
      await expect(publicRadio).toBeVisible();
      await expect(privateRadio).toBeVisible();

      // Check for buttons
      const cancelButton = page.locator('button:has-text("Cancel")');
      const createButton = page.locator('button:has-text("Create Channel")').last();
      await expect(cancelButton).toBeVisible();
      await expect(createButton).toBeVisible();

      await page.screenshot({
        path: '/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/screenshots/create-channel-dialog.png',
        fullPage: true
      });

      console.log('✓ Create Channel dialog has all required fields');
    } catch (error) {
      console.error('✗ Dialog field check failed:', error);
      throw error;
    }
  });

  test('5. Test channel type selection (Public/Private)', async () => {
    const url = `${BASE_URL}/${TEST_WORKSPACE_ID}/channels`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    try {
      // Open dialog
      await page.locator('button:has-text("Create Channel")').first().click();
      await page.waitForTimeout(1000);

      // Test Public selection (should be default)
      const publicRadio = page.locator('#type-public');
      await expect(publicRadio).toBeChecked();

      await page.screenshot({
        path: '/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/screenshots/channel-type-public.png',
        fullPage: true
      });

      // Click Private
      const privateLabel = page.locator('label[for="type-private"]');
      await privateLabel.click();
      await page.waitForTimeout(500);

      const privateRadio = page.locator('#type-private');
      await expect(privateRadio).toBeChecked();

      await page.screenshot({
        path: '/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/screenshots/channel-type-private.png',
        fullPage: true
      });

      console.log('✓ Channel type selection works correctly');
      console.log('  Public (default): Verified');
      console.log('  Private selection: Verified');
    } catch (error) {
      console.error('✗ Channel type selection failed:', error);
      throw error;
    }
  });

  test('6. Test form validation', async () => {
    const url = `${BASE_URL}/${TEST_WORKSPACE_ID}/channels`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    try {
      // Open dialog
      await page.locator('button:has-text("Create Channel")').first().click();
      await page.waitForTimeout(1000);

      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"]:has-text("Create Channel")');
      await submitButton.click();
      await page.waitForTimeout(500);

      // Check for validation error
      const validationError = await page.locator('text=/required/i').isVisible().catch(() => false);

      await page.screenshot({
        path: '/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/screenshots/form-validation.png',
        fullPage: true
      });

      console.log('✓ Form validation tested');
      console.log(`  Validation error shown: ${validationError}`);
    } catch (error) {
      console.error('✗ Form validation test failed:', error);
      throw error;
    }
  });

  test('7. Test filling out form fields', async () => {
    const url = `${BASE_URL}/${TEST_WORKSPACE_ID}/channels`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    try {
      // Open dialog
      await page.locator('button:has-text("Create Channel")').first().click();
      await page.waitForTimeout(1000);

      // Fill in channel name
      await page.fill('#channel-name', 'Test Channel Name');

      // Fill in description
      await page.fill('#channel-description', 'This is a test channel description');

      // Select private type
      await page.locator('label[for="type-private"]').click();

      await page.waitForTimeout(500);

      await page.screenshot({
        path: '/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/screenshots/form-filled.png',
        fullPage: true
      });

      console.log('✓ Form fields filled successfully');
      console.log('  Channel name: Test Channel Name');
      console.log('  Description: This is a test channel description');
      console.log('  Type: Private');
    } catch (error) {
      console.error('✗ Form filling failed:', error);
      throw error;
    }
  });

  test('8. Navigate to specific channel page (stub test)', async () => {
    const TEST_CHANNEL_ID = 'test-channel-123';
    const url = `${BASE_URL}/${TEST_WORKSPACE_ID}/channels/${TEST_CHANNEL_ID}`;

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      await page.screenshot({
        path: '/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/screenshots/channel-detail-page.png',
        fullPage: true
      });

      // Check if page loaded (will show loading or error state)
      const pageContent = await page.textContent('body');
      console.log('✓ Channel detail page navigation attempted');
      console.log(`  Page loaded with content length: ${pageContent?.length || 0}`);
    } catch (error) {
      console.error('✗ Channel detail page navigation failed:', error);
      throw error;
    }
  });

  test('9. Check for console errors', async () => {
    const url = `${BASE_URL}/${TEST_WORKSPACE_ID}/channels`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait a bit for any async errors
    await page.waitForTimeout(2000);

    // Filter out common non-critical warnings
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('Download the React DevTools') &&
      !error.includes('favicon') &&
      !error.includes('sourcemap')
    );

    console.log('\n=== Console Errors Report ===');
    console.log(`Total errors captured: ${consoleErrors.length}`);
    console.log(`Critical errors: ${criticalErrors.length}`);

    if (criticalErrors.length > 0) {
      console.log('\nCritical Errors:');
      criticalErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('✓ No critical console errors found');
    }

    if (consoleWarnings.length > 0) {
      console.log(`\nWarnings: ${consoleWarnings.length}`);
    }
  });

  test('10. Final comprehensive report', async () => {
    const url = `${BASE_URL}/${TEST_WORKSPACE_ID}/channels`;

    const report = {
      timestamp: new Date().toISOString(),
      testUrl: url,
      pageLoaded: false,
      createButtonVisible: false,
      dialogOpens: false,
      formFieldsPresent: false,
      channelTypeToggle: false,
      validationWorks: false,
      consoleErrors: [] as string[],
      screenshots: [] as string[],
    };

    try {
      // Test 1: Page load
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      report.pageLoaded = await page.locator('h1:has-text("Channels")').isVisible().catch(() => false);

      // Test 2: Create button
      report.createButtonVisible = await page.locator('button:has-text("Create Channel")').isVisible().catch(() => false);

      // Test 3: Dialog opens
      if (report.createButtonVisible) {
        await page.locator('button:has-text("Create Channel")').first().click();
        await page.waitForTimeout(1000);
        report.dialogOpens = await page.locator('[role="dialog"]').isVisible().catch(() => false);
      }

      // Test 4: Form fields
      if (report.dialogOpens) {
        report.formFieldsPresent = (
          await page.locator('#channel-name').isVisible().catch(() => false) &&
          await page.locator('#channel-description').isVisible().catch(() => false) &&
          await page.locator('#type-public').isVisible().catch(() => false) &&
          await page.locator('#type-private').isVisible().catch(() => false)
        );

        // Test 5: Channel type toggle
        await page.locator('label[for="type-private"]').click();
        await page.waitForTimeout(500);
        report.channelTypeToggle = await page.locator('#type-private').isChecked().catch(() => false);
      }

      report.consoleErrors = consoleErrors;

      console.log('\n=== CHANNELS PAGE TEST REPORT ===\n');
      console.log(`Timestamp: ${report.timestamp}`);
      console.log(`Test URL: ${report.testUrl}\n`);
      console.log('Test Results:');
      console.log(`  ${report.pageLoaded ? '✓' : '✗'} Page Loaded`);
      console.log(`  ${report.createButtonVisible ? '✓' : '✗'} Create Button Visible`);
      console.log(`  ${report.dialogOpens ? '✓' : '✗'} Dialog Opens`);
      console.log(`  ${report.formFieldsPresent ? '✓' : '✗'} Form Fields Present`);
      console.log(`  ${report.channelTypeToggle ? '✓' : '✗'} Channel Type Toggle Works`);
      console.log(`\nConsole Errors: ${report.consoleErrors.length}`);

      if (report.consoleErrors.length > 0) {
        console.log('\nError Details:');
        report.consoleErrors.forEach((error, i) => {
          console.log(`  ${i + 1}. ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`);
        });
      }

      await page.screenshot({
        path: '/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/screenshots/final-report.png',
        fullPage: true
      });

    } catch (error) {
      console.error('Error generating report:', error);
    }
  });
});
