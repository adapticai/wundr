/**
 * Quick check script for deployments page
 */
import { chromium } from '@playwright/test';

async function checkDeploymentsPage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  const consoleMessages = [];

  // Capture console messages
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
    });
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    errors.push(`PAGE ERROR: ${error.message}`);
  });

  // Capture failed requests
  const failedRequests = [];
  page.on('requestfailed', request => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      error: request.failure()?.errorText,
    });
  });

  try {
    console.log('Navigating to deployments page...');
    await page.goto('http://localhost:3000/ws_test_123/deployments', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    console.log('\n=== PAGE LOADED ===\n');

    // Take screenshot
    await page.screenshot({
      path: '/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/tests/deployments-page.png',
      fullPage: true,
    });
    console.log('Screenshot saved to tests/deployments-page.png');

    // Check for main elements
    console.log('\n=== CHECKING PAGE ELEMENTS ===\n');

    const h1 = await page.textContent('h1');
    console.log('✓ Page title:', h1);

    const newDeploymentBtn = await page
      .locator('button:has-text("New Deployment")')
      .count();
    console.log(
      newDeploymentBtn > 0
        ? '✓ New Deployment button found'
        : '✗ New Deployment button NOT found'
    );

    // Check stats cards
    const statsCards = await page.locator('text=Total').count();
    console.log(
      statsCards > 0 ? '✓ Stats cards found' : '✗ Stats cards NOT found'
    );

    // Check environment filters
    const allFilter = await page.locator('button:has-text("All")').count();
    const prodFilter = await page
      .locator('button:has-text("Production")')
      .count();
    console.log(
      allFilter > 0 && prodFilter > 0
        ? '✓ Environment filters found'
        : '✗ Environment filters NOT found'
    );

    // Check search
    const search = await page.locator('input[placeholder*="Search"]').count();
    console.log(
      search > 0 ? '✓ Search input found' : '✗ Search input NOT found'
    );

    // Try to open modal
    console.log('\n=== TESTING NEW DEPLOYMENT MODAL ===\n');
    await page.click('button:has-text("New Deployment")');
    await page.waitForTimeout(1000);

    const modalTitle = await page.locator('text=Create New Deployment').count();
    console.log(
      modalTitle > 0 ? '✓ Modal opens successfully' : '✗ Modal did NOT open'
    );

    if (modalTitle > 0) {
      // Check form fields
      const nameInput = await page.locator('input[id="name"]').count();
      const descInput = await page
        .locator('textarea[id="description"]')
        .count();
      const typeSelect = await page.locator('select[id="type"]').count();
      const envSelect = await page.locator('select[id="environment"]').count();

      console.log(
        nameInput > 0 ? '✓ Name input found' : '✗ Name input NOT found'
      );
      console.log(
        descInput > 0
          ? '✓ Description textarea found'
          : '✗ Description textarea NOT found'
      );
      console.log(
        typeSelect > 0 ? '✓ Type select found' : '✗ Type select NOT found'
      );
      console.log(
        envSelect > 0
          ? '✓ Environment select found'
          : '✗ Environment select NOT found'
      );

      // Check environment options
      const envOptions = await page
        .locator('select[id="environment"] option')
        .allTextContents();
      console.log('Environment options:', envOptions);

      // Check type options
      const typeOptions = await page
        .locator('select[id="type"] option')
        .allTextContents();
      console.log('Type options:', typeOptions);

      // Check config section
      const configSection = await page.locator('text=Configuration').count();
      console.log(
        configSection > 0
          ? '✓ Configuration section found'
          : '✗ Configuration section NOT found'
      );

      const regionSelect = await page.locator('select[id="region"]').count();
      const replicasInput = await page.locator('input[id="replicas"]').count();
      const cpuInput = await page.locator('input[id="cpu"]').count();
      const memoryInput = await page.locator('input[id="memory"]').count();

      console.log(
        regionSelect > 0 ? '✓ Region select found' : '✗ Region select NOT found'
      );
      console.log(
        replicasInput > 0
          ? '✓ Replicas input found'
          : '✗ Replicas input NOT found'
      );
      console.log(cpuInput > 0 ? '✓ CPU input found' : '✗ CPU input NOT found');
      console.log(
        memoryInput > 0 ? '✓ Memory input found' : '✗ Memory input NOT found'
      );
    }

    // Report errors
    console.log('\n=== ERROR REPORT ===\n');
    if (errors.length > 0) {
      console.log('🚨 ERRORS FOUND:');
      errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    } else {
      console.log('✅ No errors detected');
    }

    // Report failed requests
    if (failedRequests.length > 0) {
      console.log('\n🚨 FAILED REQUESTS:');
      failedRequests.forEach((req, i) => {
        console.log(`  ${i + 1}. ${req.method} ${req.url}`);
        console.log(`     Error: ${req.error}`);
      });
    } else {
      console.log('✅ No failed requests');
    }

    // Show console messages
    console.log('\n=== CONSOLE MESSAGES ===\n');
    const errorMessages = consoleMessages.filter(m => m.type === 'error');
    const warningMessages = consoleMessages.filter(m => m.type === 'warning');

    if (errorMessages.length > 0) {
      console.log('Console Errors:');
      errorMessages.forEach(m => console.log(`  - ${m.text}`));
    }

    if (warningMessages.length > 0) {
      console.log('Console Warnings:');
      warningMessages.forEach(m => console.log(`  - ${m.text}`));
    }

    console.log('\n=== TEST COMPLETE ===\n');
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await browser.close();
  }
}

checkDeploymentsPage();
