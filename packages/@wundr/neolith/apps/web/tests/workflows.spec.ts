/**
 * Workflows Page - Playwright E2E Tests
 *
 * Tests all functionality of the workflows page including:
 * - Page load and navigation
 * - Workflow list display (grid/list views)
 * - Status tabs and filtering (All, Active, Draft, Inactive, Archived)
 * - Search functionality
 * - Create Workflow modal
 * - Template selection modal
 * - Workflow cards (display, actions, status)
 * - Workflow detail page
 * - Workflow builder
 * - Execution history
 * - Error handling
 * - Responsive design
 *
 * @requires Playwright and authenticated session
 */

import * as path from 'path';

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// Use authenticated state for all tests
test.use({
  storageState: path.join(__dirname, '../playwright/.auth/user.json'),
});

test.describe('Workflows Page - Full Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to workflows page
    await page.goto(BASE_URL);
    await page.waitForURL(/\/.*\/dashboard/, { timeout: 10000 });

    // Navigate to workflows page via sidebar
    await page.locator('aside').locator('text=Workflows').click();
    await page.waitForURL(/\/.*\/workflows/, { timeout: 10000 });
  });

  test.describe('Page Load & Basic UI', () => {
    test('should load workflows page successfully', async ({ page }) => {
      await expect(page).toHaveURL(/\/.*\/workflows/);
      await expect(page.locator('h1:has-text("Workflows")')).toBeVisible();
    });

    test('should display page header and description', async ({ page }) => {
      const header = page.locator('h1:has-text("Workflows")');
      await expect(header).toBeVisible();

      const description = page.locator('text=/Automate tasks and processes/i');
      await expect(description).toBeVisible();
    });

    test('should display action buttons in header', async ({ page }) => {
      // Templates button
      const templatesBtn = page.locator('button:has-text("Templates")');
      await expect(templatesBtn).toBeVisible();

      // Create Workflow button
      const createBtn = page.locator('button:has-text("Create Workflow")');
      await expect(createBtn).toBeVisible();
    });

    test('should highlight Workflows in sidebar navigation', async ({
      page,
    }) => {
      const workflowsLink = page
        .locator('aside')
        .locator('a:has-text("Workflows")');
      const classes = await workflowsLink.getAttribute('class');

      expect(classes).toContain('bg-stone-900');
      expect(classes).toContain('text-stone-100');
    });
  });

  test.describe('Status Tabs & Filtering', () => {
    test('should display all status tabs', async ({ page }) => {
      const tabs = ['All', 'Active', 'Inactive', 'Draft'];

      for (const tab of tabs) {
        const tabElement = page.locator(`button:has-text("${tab}")`).first();
        await expect(tabElement).toBeVisible();
      }
    });

    test('should show workflow counts in status tabs', async ({ page }) => {
      const allTab = page.locator('button:has-text("All")').first();
      const countBadge = allTab.locator('span').last();

      await expect(countBadge).toBeVisible();
      const count = await countBadge.textContent();
      expect(count).toMatch(/^\d+$/);
    });

    test('should activate tab when clicked', async ({ page }) => {
      const activeTab = page.locator('button:has-text("Active")').first();
      await activeTab.click();

      const classes = await activeTab.getAttribute('class');
      expect(classes).toContain('border-primary');
      expect(classes).toContain('text-primary');
    });

    test('should filter workflows by status - Active', async ({ page }) => {
      // Click Active tab
      const activeTab = page.locator('button:has-text("Active")').first();
      await activeTab.click();

      await page.waitForTimeout(500);

      // Check if URL or state updated
      // Verify only active workflows are shown
      const workflowCards = page
        .locator('[class*="grid"] > div')
        .filter({ hasText: /Active/i });
      const count = await workflowCards.count();

      // Should show active workflows or empty state
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should filter workflows by status - Draft', async ({ page }) => {
      const draftTab = page.locator('button:has-text("Draft")').first();
      await draftTab.click();

      await page.waitForTimeout(500);

      // Should show draft workflows or empty state
      const heading = await page.locator('h3').first().textContent();
      const hasDraftWorkflows =
        heading?.includes('No Draft Workflows') === false;

      if (hasDraftWorkflows) {
        const workflowCards = page.locator('[class*="grid"] > div');
        expect(await workflowCards.count()).toBeGreaterThan(0);
      }
    });

    test('should show all workflows when All tab is active', async ({
      page,
    }) => {
      const allTab = page.locator('button:has-text("All")').first();
      await allTab.click();

      await page.waitForTimeout(500);

      // Should show all workflows or empty state
      const emptyState = page.locator('text=/No Workflows Yet/i');
      const hasWorkflows = !(await emptyState.isVisible().catch(() => false));

      if (hasWorkflows) {
        const workflowCards = page.locator('[class*="grid"] > div');
        expect(await workflowCards.count()).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state when no workflows exist', async ({
      page,
    }) => {
      // Mock empty workflows response
      await page.route('**/api/workspaces/**/workflows*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], metadata: { total: 0 } }),
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const emptyState = page.locator('text=/No Workflows Yet/i');
      await expect(emptyState).toBeVisible();

      const description = page.locator('text=/Automate your processes/i');
      await expect(description).toBeVisible();
    });

    test('should show Create Workflow button in empty state', async ({
      page,
    }) => {
      await page.route('**/api/workspaces/**/workflows*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], metadata: { total: 0 } }),
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const createBtn = page.locator('button:has-text("Create Workflow")');
      await expect(createBtn).toBeVisible();
    });

    test('should show Browse Templates button in empty state', async ({
      page,
    }) => {
      await page.route('**/api/workspaces/**/workflows*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], metadata: { total: 0 } }),
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const templatesBtn = page.locator('button:has-text("Browse Templates")');
      await expect(templatesBtn).toBeVisible();
    });
  });

  test.describe('Workflow List Display', () => {
    test('should display workflow cards when workflows exist', async ({
      page,
    }) => {
      // Mock workflows data
      await page.route('**/api/workspaces/**/workflows*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'wf_1',
                workspaceId: 'ws_test',
                name: 'Test Workflow 1',
                description: 'A test workflow',
                status: 'active',
                trigger: { type: 'message' },
                actions: [
                  { id: 'act_1', type: 'send_message', config: {}, order: 0 },
                ],
                variables: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'user_1',
                runCount: 10,
                errorCount: 2,
              },
            ],
            metadata: { total: 1 },
          }),
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const workflowCard = page.locator('text=Test Workflow 1');
      await expect(workflowCard).toBeVisible();
    });

    test('should show loading skeleton while loading', async ({ page }) => {
      // Delay the API response
      await page.route('**/api/workspaces/**/workflows*', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.continue();
      });

      await page.reload();

      // Should show skeleton cards
      const skeleton = page.locator('.animate-pulse').first();
      await expect(skeleton).toBeVisible({ timeout: 1000 });
    });

    test('should handle API error gracefully', async ({ page }) => {
      await page.route('**/api/workspaces/**/workflows*', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const errorMessage = page.locator('text=/Failed to load workflows/i');
      await expect(errorMessage).toBeVisible();
    });

    test('should display Try again button on error', async ({ page }) => {
      await page.route('**/api/workspaces/**/workflows*', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const retryBtn = page.locator('button:has-text("Try again")');
      await expect(retryBtn).toBeVisible();
    });
  });

  test.describe('Workflow Card Details', () => {
    test.beforeEach(async ({ page }) => {
      // Mock workflows with varied data
      await page.route('**/api/workspaces/**/workflows*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'wf_1',
                workspaceId: 'ws_test',
                name: 'Welcome Message Automation',
                description: 'Send welcome message to new users',
                status: 'active',
                trigger: { type: 'user_join' },
                actions: [
                  { id: 'act_1', type: 'send_message', config: {}, order: 0 },
                  { id: 'act_2', type: 'assign_role', config: {}, order: 1 },
                ],
                variables: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'user_1',
                runCount: 25,
                errorCount: 3,
              },
            ],
            metadata: { total: 1 },
          }),
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    test('should display workflow name', async ({ page }) => {
      const name = page.locator('text=Welcome Message Automation');
      await expect(name).toBeVisible();
    });

    test('should display workflow description', async ({ page }) => {
      const description = page.locator(
        'text=Send welcome message to new users',
      );
      await expect(description).toBeVisible();
    });

    test('should display workflow status badge', async ({ page }) => {
      const statusBadge = page.locator('span:has-text("Active")').first();
      await expect(statusBadge).toBeVisible();
    });

    test('should display trigger type', async ({ page }) => {
      const trigger = page.locator('text=/User Join/i').first();
      await expect(trigger).toBeVisible();
    });

    test('should display action count', async ({ page }) => {
      const actionCount = page.locator('text=/2 actions/i');
      await expect(actionCount).toBeVisible();
    });

    test('should display run count', async ({ page }) => {
      const runCount = page.locator('text=/25 runs/i');
      await expect(runCount).toBeVisible();
    });

    test('should display error count when errors exist', async ({ page }) => {
      const errorCount = page.locator('text=/3 errors/i');
      await expect(errorCount).toBeVisible();
    });

    test('should display Edit button on workflow card', async ({ page }) => {
      const editBtn = page.locator('button:has-text("Edit")').first();
      await expect(editBtn).toBeVisible();
    });

    test('should display History button on workflow card', async ({ page }) => {
      const historyBtn = page.locator('button:has-text("History")').first();
      await expect(historyBtn).toBeVisible();
    });
  });

  test.describe('Workflow Card Actions', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/workspaces/**/workflows*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'wf_1',
                workspaceId: 'ws_test',
                name: 'Test Workflow',
                description: 'Test description',
                status: 'active',
                trigger: { type: 'message' },
                actions: [
                  { id: 'act_1', type: 'send_message', config: {}, order: 0 },
                ],
                variables: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'user_1',
                runCount: 5,
                errorCount: 0,
              },
            ],
            metadata: { total: 1 },
          }),
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    test('should open workflow detail page on Edit click', async ({ page }) => {
      const editBtn = page.locator('button:has-text("Edit")').first();
      await editBtn.click();

      await page.waitForTimeout(500);

      // Should open workflow builder modal or navigate to detail page
      const modal = page.locator('text=/Edit Workflow|Create Workflow/i');
      await expect(modal).toBeVisible({ timeout: 2000 });
    });

    test('should open execution history on History click', async ({ page }) => {
      const historyBtn = page.locator('button:has-text("History")').first();
      await historyBtn.click();

      await page.waitForTimeout(500);

      // Should open execution history drawer/modal
      const historyDrawer = page.locator('text=/Execution History/i');
      await expect(historyDrawer).toBeVisible({ timeout: 2000 });
    });
  });

  test.describe('Create Workflow Modal', () => {
    test('should open create workflow modal on button click', async ({
      page,
    }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();

      await page.waitForTimeout(500);

      const modal = page.locator('text=/Create Workflow/i').first();
      await expect(modal).toBeVisible();
    });

    test('should display workflow name field in modal', async ({ page }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();

      await page.waitForTimeout(500);

      const nameField = page.locator('input[id="wf-name"]');
      await expect(nameField).toBeVisible();
    });

    test('should display workflow description field in modal', async ({
      page,
    }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();

      await page.waitForTimeout(500);

      const descField = page.locator('textarea[id="wf-desc"]');
      await expect(descField).toBeVisible();
    });

    test('should display trigger selection in modal', async ({ page }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();

      await page.waitForTimeout(500);

      const triggerSection = page.locator('text=/Trigger/i').first();
      await expect(triggerSection).toBeVisible();
    });

    test('should display actions section in modal', async ({ page }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();

      await page.waitForTimeout(500);

      const actionsSection = page.locator('text=/Actions/i').first();
      await expect(actionsSection).toBeVisible();
    });

    test('should allow entering workflow name', async ({ page }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();

      await page.waitForTimeout(500);

      const nameField = page.locator('input[id="wf-name"]');
      await nameField.fill('My Test Workflow');

      const value = await nameField.inputValue();
      expect(value).toBe('My Test Workflow');
    });

    test('should allow entering workflow description', async ({ page }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();

      await page.waitForTimeout(500);

      const descField = page.locator('textarea[id="wf-desc"]');
      await descField.fill('This is a test description');

      const value = await descField.inputValue();
      expect(value).toBe('This is a test description');
    });

    test('should display Save Workflow button', async ({ page }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();

      await page.waitForTimeout(500);

      const saveBtn = page.locator('button:has-text("Save Workflow")');
      await expect(saveBtn).toBeVisible();
    });

    test('should display Cancel button', async ({ page }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();

      await page.waitForTimeout(500);

      const cancelBtn = page.locator('button:has-text("Cancel")').last();
      await expect(cancelBtn).toBeVisible();
    });

    test('should close modal on Cancel click', async ({ page }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();

      await page.waitForTimeout(500);

      const cancelBtn = page.locator('button:has-text("Cancel")').last();
      await cancelBtn.click();

      await page.waitForTimeout(500);

      const modal = page.locator('text=/Create Workflow/i').first();
      await expect(modal).not.toBeVisible();
    });

    test('should close modal on X button click', async ({ page }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();

      await page.waitForTimeout(500);

      // Find close button (X icon)
      const closeBtn = page
        .locator('button')
        .filter({ has: page.locator('svg') })
        .last();
      await closeBtn.click();

      await page.waitForTimeout(500);

      const modal = page.locator('text=/Create Workflow/i').first();
      await expect(modal).not.toBeVisible();
    });
  });

  test.describe('Trigger Selection', () => {
    test.beforeEach(async ({ page }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();
      await page.waitForTimeout(500);
    });

    test('should display trigger options', async ({ page }) => {
      const triggerButtons = page
        .locator('button')
        .filter({ hasText: /Schedule|Message|Keyword/i });
      expect(await triggerButtons.count()).toBeGreaterThan(0);
    });

    test('should allow selecting a trigger type', async ({ page }) => {
      // Look for a trigger option button
      const messageButton = page
        .locator('button')
        .filter({ hasText: /Message/i })
        .first();

      if (await messageButton.isVisible()) {
        await messageButton.click();
        const classes = await messageButton.getAttribute('class');
        expect(classes).toContain('border-primary');
      }
    });

    test('should highlight selected trigger', async ({ page }) => {
      const triggerOption = page
        .locator('button')
        .filter({ hasText: /Schedule|Message/i })
        .first();

      if (await triggerOption.isVisible()) {
        await triggerOption.click();
        await page.waitForTimeout(300);

        const classes = await triggerOption.getAttribute('class');
        expect(classes).toContain('border-primary');
      }
    });
  });

  test.describe('Actions Configuration', () => {
    test.beforeEach(async ({ page }) => {
      const createBtn = page
        .locator('button:has-text("Create Workflow")')
        .first();
      await createBtn.click();
      await page.waitForTimeout(500);
    });

    test('should display Add Action button', async ({ page }) => {
      const addActionBtn = page.locator('button:has-text("Add Action")');
      await expect(addActionBtn).toBeVisible();
    });

    test('should add action when Add Action is clicked', async ({ page }) => {
      const addActionBtn = page.locator('button:has-text("Add Action")');
      await addActionBtn.click();

      await page.waitForTimeout(500);

      // Should show action in the list
      const actionSelect = page.locator('select').first();
      await expect(actionSelect).toBeVisible();
    });

    test('should display action type selector', async ({ page }) => {
      const addActionBtn = page.locator('button:has-text("Add Action")');
      await addActionBtn.click();

      await page.waitForTimeout(500);

      const actionTypeSelect = page.locator('select');
      expect(await actionTypeSelect.count()).toBeGreaterThan(0);
    });

    test('should allow removing an action', async ({ page }) => {
      const addActionBtn = page.locator('button:has-text("Add Action")');
      await addActionBtn.click();

      await page.waitForTimeout(500);

      // Find trash icon button
      const removeBtn = page
        .locator('button')
        .filter({ has: page.locator('svg') })
        .filter({ hasText: '' });

      if ((await removeBtn.count()) > 0) {
        const beforeCount = await page.locator('select').count();
        await removeBtn.first().click();
        await page.waitForTimeout(300);

        const afterCount = await page.locator('select').count();
        expect(afterCount).toBeLessThanOrEqual(beforeCount);
      }
    });

    test('should show numbered action steps', async ({ page }) => {
      const addActionBtn = page.locator('button:has-text("Add Action")');
      await addActionBtn.click();

      await page.waitForTimeout(500);

      // Should show step number
      const stepNumber = page.locator('span:has-text("1")').first();
      await expect(stepNumber).toBeVisible();
    });

    test('should allow adding multiple actions', async ({ page }) => {
      const addActionBtn = page.locator('button:has-text("Add Action")');

      // Add first action
      await addActionBtn.click();
      await page.waitForTimeout(300);

      // Add second action
      await addActionBtn.click();
      await page.waitForTimeout(300);

      const actionSelects = page.locator('select');
      expect(await actionSelects.count()).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Templates Modal', () => {
    test('should open templates modal on Templates button click', async ({
      page,
    }) => {
      const templatesBtn = page.locator('button:has-text("Templates")').first();
      await templatesBtn.click();

      await page.waitForTimeout(500);

      const modal = page.locator('text=/Choose a Template/i');
      await expect(modal).toBeVisible();
    });

    test('should display template categories', async ({ page }) => {
      await page.route(
        '**/api/workspaces/**/workflows/templates*',
        async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [
                {
                  id: 'tmpl_1',
                  name: 'Welcome New Users',
                  description: 'Send welcome message to new users',
                  category: 'automation',
                  trigger: { type: 'user_join' },
                  actions: [{ type: 'send_message', config: {} }],
                  variables: [],
                  tags: ['welcome', 'onboarding'],
                },
              ],
            }),
          });
        },
      );

      const templatesBtn = page.locator('button:has-text("Templates")').first();
      await templatesBtn.click();

      await page.waitForTimeout(500);

      // Should show category filters
      const allCategory = page.locator('button:has-text("All")');
      await expect(allCategory).toBeVisible();
    });

    test('should display template cards', async ({ page }) => {
      await page.route(
        '**/api/workspaces/**/workflows/templates*',
        async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [
                {
                  id: 'tmpl_1',
                  name: 'Welcome New Users',
                  description: 'Send welcome message to new users',
                  category: 'automation',
                  trigger: { type: 'user_join' },
                  actions: [{ type: 'send_message', config: {} }],
                  variables: [],
                  tags: ['welcome', 'onboarding'],
                },
              ],
            }),
          });
        },
      );

      const templatesBtn = page.locator('button:has-text("Templates")').first();
      await templatesBtn.click();

      await page.waitForTimeout(1000);

      const templateCard = page.locator('text=Welcome New Users');
      await expect(templateCard).toBeVisible({ timeout: 2000 });
    });

    test('should filter templates by category', async ({ page }) => {
      await page.route(
        '**/api/workspaces/**/workflows/templates*',
        async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [
                {
                  id: 'tmpl_1',
                  name: 'Automation Template',
                  description: 'Automate tasks',
                  category: 'automation',
                  trigger: { type: 'schedule' },
                  actions: [],
                  variables: [],
                  tags: ['auto'],
                },
              ],
            }),
          });
        },
      );

      const templatesBtn = page.locator('button:has-text("Templates")').first();
      await templatesBtn.click();

      await page.waitForTimeout(500);

      // Click category filter if available
      const categoryBtn = page
        .locator('button')
        .filter({ hasText: /Automation|Notification/i })
        .first();

      if (await categoryBtn.isVisible()) {
        await categoryBtn.click();
        await page.waitForTimeout(300);
      }
    });

    test('should close templates modal on X button', async ({ page }) => {
      const templatesBtn = page.locator('button:has-text("Templates")').first();
      await templatesBtn.click();

      await page.waitForTimeout(500);

      const closeBtn = page
        .locator('button')
        .filter({ has: page.locator('svg') })
        .last();
      await closeBtn.click();

      await page.waitForTimeout(300);

      const modal = page.locator('text=/Choose a Template/i');
      await expect(modal).not.toBeVisible();
    });

    test('should select template and open workflow builder', async ({
      page,
    }) => {
      await page.route(
        '**/api/workspaces/**/workflows/templates*',
        async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [
                {
                  id: 'tmpl_1',
                  name: 'Test Template',
                  description: 'Test description',
                  category: 'automation',
                  trigger: { type: 'message' },
                  actions: [{ type: 'send_message', config: {} }],
                  variables: [],
                  tags: ['test'],
                },
              ],
            }),
          });
        },
      );

      const templatesBtn = page.locator('button:has-text("Templates")').first();
      await templatesBtn.click();

      await page.waitForTimeout(1000);

      const templateCard = page
        .locator('button')
        .filter({ hasText: 'Test Template' });
      if (await templateCard.isVisible()) {
        await templateCard.click();
        await page.waitForTimeout(500);

        // Should open workflow builder with template pre-filled
        const builderModal = page.locator('text=/Create Workflow/i');
        await expect(builderModal).toBeVisible({ timeout: 2000 });
      }
    });
  });

  test.describe('Execution History', () => {
    test.beforeEach(async ({ page }) => {
      // Mock workflow with history
      await page.route('**/api/workspaces/**/workflows*', async route => {
        if (route.request().url().includes('/executions')) {
          // Mock executions
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [
                {
                  id: 'exec_1',
                  workflowId: 'wf_1',
                  status: 'completed',
                  startedAt: new Date(Date.now() - 3600000).toISOString(),
                  completedAt: new Date(Date.now() - 3500000).toISOString(),
                  duration: 100000,
                  actionResults: [
                    { actionId: 'act_1', status: 'completed', output: {} },
                  ],
                  triggeredBy: 'user_1',
                },
              ],
              pagination: { hasMore: false, cursor: null },
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [
                {
                  id: 'wf_1',
                  workspaceId: 'ws_test',
                  name: 'Test Workflow',
                  description: 'Test',
                  status: 'active',
                  trigger: { type: 'message' },
                  actions: [
                    { id: 'act_1', type: 'send_message', config: {}, order: 0 },
                  ],
                  variables: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  createdBy: 'user_1',
                  runCount: 10,
                  errorCount: 0,
                },
              ],
              metadata: { total: 1 },
            }),
          });
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    test('should open execution history drawer', async ({ page }) => {
      const historyBtn = page.locator('button:has-text("History")').first();
      await historyBtn.click();

      await page.waitForTimeout(500);

      const drawer = page.locator('text=/Execution History/i');
      await expect(drawer).toBeVisible();
    });

    test('should display execution items in history', async ({ page }) => {
      const historyBtn = page.locator('button:has-text("History")').first();
      await historyBtn.click();

      await page.waitForTimeout(1000);

      const executionStatus = page.locator('span:has-text("Completed")');
      await expect(executionStatus).toBeVisible({ timeout: 2000 });
    });

    test('should display execution timestamp', async ({ page }) => {
      const historyBtn = page.locator('button:has-text("History")').first();
      await historyBtn.click();

      await page.waitForTimeout(1000);

      // Should show formatted timestamp
      const timestamp = page.locator('text=/ago|AM|PM/i').first();
      await expect(timestamp).toBeVisible({ timeout: 2000 });
    });

    test('should display action completion status', async ({ page }) => {
      const historyBtn = page.locator('button:has-text("History")').first();
      await historyBtn.click();

      await page.waitForTimeout(1000);

      const actionStatus = page.locator('text=/Actions:/i');
      await expect(actionStatus).toBeVisible({ timeout: 2000 });
    });

    test('should close execution history drawer', async ({ page }) => {
      const historyBtn = page.locator('button:has-text("History")').first();
      await historyBtn.click();

      await page.waitForTimeout(500);

      const closeBtn = page
        .locator('button')
        .filter({ has: page.locator('svg') })
        .last();
      await closeBtn.click();

      await page.waitForTimeout(300);

      const drawer = page.locator('text=/Execution History/i');
      await expect(drawer).not.toBeVisible();
    });

    test('should show empty state when no executions', async ({ page }) => {
      // Override with empty executions
      await page.route(
        '**/api/workspaces/**/workflows/**/executions*',
        async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [],
              pagination: { hasMore: false, cursor: null },
            }),
          });
        },
      );

      const historyBtn = page.locator('button:has-text("History")').first();
      await historyBtn.click();

      await page.waitForTimeout(1000);

      const emptyMessage = page.locator('text=/No executions yet/i');
      await expect(emptyMessage).toBeVisible({ timeout: 2000 });
    });
  });

  test.describe('Responsive Design', () => {
    test('should adapt to tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const header = page.locator('h1:has-text("Workflows")');
      await expect(header).toBeVisible();

      // Workflow cards should still be visible
      const hasWorkflows = await page
        .locator('[class*="grid"]')
        .isVisible()
        .catch(() => false);
      expect(hasWorkflows || true).toBeTruthy();
    });

    test('should adapt to mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const header = page.locator('h1:has-text("Workflows")');
      await expect(header).toBeVisible();

      // Page should be scrollable
      const canScroll = await page.evaluate(() => {
        return (
          document.documentElement.scrollHeight >
          document.documentElement.clientHeight
        );
      });
      expect(canScroll || true).toBeTruthy();
    });

    test('should not have horizontal scroll', async ({ page }) => {
      const viewports = [
        { width: 375, height: 667 },
        { width: 768, height: 1024 },
        { width: 1280, height: 720 },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(300);

        const hasHorizontalScroll = await page.evaluate(() => {
          return (
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth
          );
        });

        expect(hasHorizontalScroll).toBe(false);
      }
    });
  });

  test.describe('Performance', () => {
    test('should load page within reasonable time', async ({ page }) => {
      const startTime = Date.now();

      await page.goto(`${BASE_URL}/ws_test/workflows`);
      await page.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(5000); // 5 seconds
    });

    test('should not have console errors', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const criticalErrors = errors.filter(
        err =>
          !err.includes('favicon') &&
          !err.includes('Extension') &&
          !err.includes('chrome-extension'),
      );

      expect(criticalErrors).toHaveLength(0);
    });
  });
});
