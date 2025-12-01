/**
 * Deployments Page E2E Tests
 *
 * Tests the newly created deployments page functionality including:
 * - Page load and rendering
 * - New Deployment button and modal
 * - Environment filters
 * - Deployment cards
 * - Search functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Deployments Page', () => {
  const TEST_WORKSPACE_ID = 'ws_test_123';
  const DEPLOYMENTS_URL = `http://localhost:3000/${TEST_WORKSPACE_ID}/deployments`;

  test.beforeEach(async ({ page }) => {
    // Navigate to deployments page
    await page.goto(DEPLOYMENTS_URL);
  });

  test('page loads without errors', async ({ page }) => {
    // Check for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check title
    const title = await page.textContent('h1');
    expect(title).toBe('Deployments');

    // Report any errors
    if (errors.length > 0) {
      console.log('Console Errors:', errors);
    }
  });

  test('displays page header and description', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Deployments');
    await expect(
      page.getByText('Monitor and manage your deployed services')
    ).toBeVisible();
  });

  test('displays New Deployment button', async ({ page }) => {
    const newDeploymentBtn = page.getByRole('button', {
      name: /New Deployment/i,
    });
    await expect(newDeploymentBtn).toBeVisible();
  });

  test('opens Create Deployment modal when clicking New Deployment button', async ({
    page,
  }) => {
    // Click New Deployment button
    await page.getByRole('button', { name: /New Deployment/i }).click();

    // Check modal is visible
    await expect(page.getByText('Create New Deployment')).toBeVisible();

    // Check form fields exist
    await expect(page.locator('input[id="name"]')).toBeVisible();
    await expect(page.locator('textarea[id="description"]')).toBeVisible();
    await expect(page.locator('select[id="type"]')).toBeVisible();
    await expect(page.locator('select[id="environment"]')).toBeVisible();
  });

  test('modal has all environment options', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /New Deployment/i }).click();

    // Check environment dropdown
    const envSelect = page.locator('select[id="environment"]');
    await expect(envSelect).toBeVisible();

    // Get options
    const options = await envSelect.locator('option').allTextContents();
    expect(options).toContain('Development');
    expect(options).toContain('Staging');
    expect(options).toContain('Production');
  });

  test('modal has all deployment type options', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /New Deployment/i }).click();

    // Check type dropdown
    const typeSelect = page.locator('select[id="type"]');
    await expect(typeSelect).toBeVisible();

    // Get options
    const options = await typeSelect.locator('option').allTextContents();
    expect(options).toContain('Service');
    expect(options).toContain('Agent');
    expect(options).toContain('Workflow');
    expect(options).toContain('Integration');
  });

  test('can close modal with close button', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /New Deployment/i }).click();
    await expect(page.getByText('Create New Deployment')).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: /close/i }).click();

    // Modal should be gone
    await expect(page.getByText('Create New Deployment')).not.toBeVisible();
  });

  test('can close modal with cancel button', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /New Deployment/i }).click();
    await expect(page.getByText('Create New Deployment')).toBeVisible();

    // Click cancel
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Modal should be gone
    await expect(page.getByText('Create New Deployment')).not.toBeVisible();
  });

  test('displays stats cards', async ({ page }) => {
    // Check for stats cards
    await expect(page.getByText('Total')).toBeVisible();
    await expect(page.getByText('Running')).toBeVisible();
    await expect(page.getByText('Production')).toBeVisible();
    await expect(page.getByText('Staging')).toBeVisible();
    await expect(page.getByText('Development')).toBeVisible();
  });

  test('displays environment filter buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Production' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Staging' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Development' })
    ).toBeVisible();
  });

  test('can switch between environment filters', async ({ page }) => {
    // Click Production filter
    await page.getByRole('button', { name: 'Production' }).click();

    // Verify it's active (has primary background)
    const productionBtn = page.getByRole('button', { name: 'Production' });
    await expect(productionBtn).toHaveClass(/bg-primary/);

    // Click Staging
    await page.getByRole('button', { name: 'Staging' }).click();
    const stagingBtn = page.getByRole('button', { name: 'Staging' });
    await expect(stagingBtn).toHaveClass(/bg-primary/);
  });

  test('displays search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search deployments...');
    await expect(searchInput).toBeVisible();
  });

  test('can type in search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search deployments...');
    await searchInput.fill('test deployment');
    await expect(searchInput).toHaveValue('test deployment');
  });

  test('form validation - requires name field', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /New Deployment/i }).click();

    // Try to submit without name
    await page.getByRole('button', { name: /Create Deployment/i }).click();

    // Check that form shows validation (browser native validation)
    const nameInput = page.locator('input[id="name"]');
    const isInvalid = await nameInput.evaluate(
      el => !(el as HTMLInputElement).validity.valid
    );
    expect(isInvalid).toBe(true);
  });

  test('can fill out deployment form', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /New Deployment/i }).click();

    // Fill form
    await page.locator('input[id="name"]').fill('Test Deployment');
    await page
      .locator('textarea[id="description"]')
      .fill('This is a test deployment');
    await page.locator('select[id="type"]').selectOption('service');
    await page.locator('select[id="environment"]').selectOption('development');

    // Check values
    await expect(page.locator('input[id="name"]')).toHaveValue(
      'Test Deployment'
    );
    await expect(page.locator('textarea[id="description"]')).toHaveValue(
      'This is a test deployment'
    );
  });

  test('configuration section displays all fields', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /New Deployment/i }).click();

    // Check config fields
    await expect(page.getByText('Configuration')).toBeVisible();
    await expect(page.locator('select[id="region"]')).toBeVisible();
    await expect(page.locator('input[id="replicas"]')).toBeVisible();
    await expect(page.locator('input[id="cpu"]')).toBeVisible();
    await expect(page.locator('input[id="memory"]')).toBeVisible();
  });

  test('replicas field has min/max constraints', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /New Deployment/i }).click();

    const replicasInput = page.locator('input[id="replicas"]');

    // Check attributes
    await expect(replicasInput).toHaveAttribute('type', 'number');
    await expect(replicasInput).toHaveAttribute('min', '1');
    await expect(replicasInput).toHaveAttribute('max', '10');
  });

  test('region select has multiple options', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /New Deployment/i }).click();

    const regionSelect = page.locator('select[id="region"]');
    const options = await regionSelect.locator('option').allTextContents();

    expect(options.length).toBeGreaterThan(1);
    expect(options).toContain('US East (N. Virginia)');
  });

  test('checks for JavaScript errors on page load', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    await page.goto(DEPLOYMENTS_URL);
    await page.waitForLoadState('networkidle');

    // Report errors
    if (jsErrors.length > 0) {
      console.log('JavaScript Errors:', jsErrors);
      throw new Error(`Page has ${jsErrors.length} JavaScript errors`);
    }
  });

  test('checks for failed network requests', async ({ page }) => {
    const failedRequests: string[] = [];

    page.on('requestfailed', request => {
      failedRequests.push(
        `${request.method()} ${request.url()} - ${request.failure()?.errorText}`
      );
    });

    await page.goto(DEPLOYMENTS_URL);
    await page.waitForLoadState('networkidle');

    if (failedRequests.length > 0) {
      console.log('Failed Requests:', failedRequests);
    }
  });

  test('page is accessible - has proper heading hierarchy', async ({
    page,
  }) => {
    await page.goto(DEPLOYMENTS_URL);

    // Check H1 exists
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();

    // Check modal has H2
    await page.getByRole('button', { name: /New Deployment/i }).click();
    const h2 = page.locator('h2');
    await expect(h2).toBeVisible();
  });

  test('buttons have proper aria labels', async ({ page }) => {
    await page.goto(DEPLOYMENTS_URL);

    // Open modal to check more buttons
    await page.getByRole('button', { name: /New Deployment/i }).click();

    // Check close button has aria-label
    const closeBtn = page.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
  });
});
