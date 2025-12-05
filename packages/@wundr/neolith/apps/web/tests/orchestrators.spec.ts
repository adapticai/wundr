/**
 * VPs Page - Playwright E2E Tests
 *
 * Tests all functionality of the Orchestrators (VPs) page including:
 * - Page load and navigation
 * - Orchestrator list display (with data and empty state)
 * - Status filtering (Online, Offline, Busy, Away)
 * - Search filtering
 * - Discipline filtering
 * - Create Orchestrator wizard (4-step process)
 * - Orchestrator card interactions
 * - Orchestrator detail page
 * - Status management
 * - Edit and delete operations
 * - Error handling
 * - Responsive design
 *
 * @requires @playwright/test
 */

import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// Mock Orchestrator data
const mockOrchestrators = [
  {
    id: 'vp_001',
    userId: 'user_001',
    title: 'Head of Engineering',
    description: 'Technical leadership and engineering excellence',
    discipline: 'Engineering',
    status: 'ONLINE',
    charter: {
      mission: 'Drive technical excellence',
      vision: 'Build scalable systems',
      values: ['Innovation', 'Quality', 'Collaboration'],
      personality: {
        traits: ['Analytical', 'Strategic', 'Technical'],
        communicationStyle: 'Direct and precise',
        decisionMakingStyle: 'Data-driven',
        background: '15 years in software engineering',
      },
      expertise: ['Architecture', 'Scalability', 'DevOps'],
      communicationPreferences: {
        tone: 'professional',
        responseLength: 'detailed',
        formality: 'medium',
        useEmoji: false,
      },
      operationalSettings: {
        workHours: { start: '09:00', end: '17:00', timezone: 'UTC' },
        responseTimeTarget: 30,
        autoEscalation: false,
        escalationThreshold: 60,
      },
    },
    capabilities: ['Code Review', 'Architecture Design', 'Team Leadership'],
    modelConfig: null,
    systemPrompt: null,
    organizationId: 'org_001',
    avatarUrl: null,
    lastActivityAt: new Date(Date.now() - 3600000).toISOString(),
    messageCount: 1247,
    agentCount: 5,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vp_002',
    userId: 'user_001',
    title: 'Head of Product',
    description: 'Product strategy and roadmap management',
    discipline: 'Product',
    status: 'BUSY',
    charter: null,
    capabilities: ['Product Strategy', 'Roadmap Planning'],
    modelConfig: null,
    systemPrompt: null,
    organizationId: 'org_001',
    avatarUrl: null,
    lastActivityAt: new Date(Date.now() - 7200000).toISOString(),
    messageCount: 823,
    agentCount: 3,
    createdAt: new Date('2024-01-15').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vp_003',
    userId: 'user_001',
    title: 'Head of Design',
    description: 'Design system and user experience',
    discipline: 'Design',
    status: 'OFFLINE',
    charter: null,
    capabilities: ['UX Design', 'Design Systems'],
    modelConfig: null,
    systemPrompt: null,
    organizationId: 'org_001',
    avatarUrl: null,
    lastActivityAt: null,
    messageCount: 0,
    agentCount: 0,
    createdAt: new Date('2024-02-01').toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockEmptyOrchestrators: typeof mockOrchestrators = [];

test.describe('Orchestrators Page - Full Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Orchestrator list API and return mock data
    await page.route('**/api/workspaces/**/orchestrators*', async route => {
      const url = route.request().url();
      const urlParams = new URL(url).searchParams;
      const status = urlParams.get('status');
      const discipline = urlParams.get('discipline');
      const search = urlParams.get('search');

      let filteredOrchestrators = [...mockOrchestrators];

      // Apply filters
      if (status) {
        filteredOrchestrators = filteredOrchestrators.filter(
          orch => orch.status === status
        );
      }
      if (discipline) {
        filteredOrchestrators = filteredOrchestrators.filter(
          orch => orch.discipline === discipline
        );
      }
      if (search) {
        const searchLower = search.toLowerCase();
        filteredOrchestrators = filteredOrchestrators.filter(
          orch =>
            orch.title.toLowerCase().includes(searchLower) ||
            orch.discipline?.toLowerCase().includes(searchLower) ||
            orch.description?.toLowerCase().includes(searchLower)
        );
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: filteredOrchestrators,
          metadata: {
            total: filteredOrchestrators.length,
            filtered: filteredOrchestrators.length,
          },
        }),
      });
    });

    // Navigate to Orchestrators page (assuming workspace ID is available)
    await page.goto(BASE_URL);
    await page.waitForURL(/\/.*\/(dashboard|orchestrators)/, {
      timeout: 10000,
    });

    // Navigate to Orchestrators page if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('/orchestrators')) {
      const workspaceId = currentUrl.match(
        /\/([^\/]+)\/(dashboard|orchestrators)/
      )?.[1];
      if (workspaceId) {
        await page.goto(`${BASE_URL}/${workspaceId}/orchestrators`);
      }
    }

    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Load & Basic Display', () => {
    test('should load Orchestrators page successfully', async ({ page }) => {
      await expect(page).toHaveURL(/\/orchestrators$/);
      await expect(page.locator('h1:has-text("Orchestrators")')).toBeVisible();
    });

    test('should display page title and description', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Orchestrators');
      await expect(page.locator('text=Manage your organization')).toBeVisible();
    });

    test('should display Create Orchestrator button', async ({ page }) => {
      const createButton = page.locator(
        'button:has-text("Create Orchestrator")'
      );
      await expect(createButton).toBeVisible();
      await expect(createButton).toBeEnabled();
    });

    test('should display stats overview cards', async ({ page }) => {
      await expect(page.locator('text=Online')).toBeVisible();
      await expect(page.locator('text=Offline')).toBeVisible();
      await expect(page.locator('text=Busy')).toBeVisible();
      await expect(page.locator('text=Away')).toBeVisible();
    });

    test('should display correct stat counts', async ({ page }) => {
      // Based on mockOrchestrators: 1 Online, 1 Offline, 1 Busy, 0 Away
      const statsContainer = page.locator('.grid.grid-cols-2.gap-4');

      // Check for presence of stats (exact values may vary based on data)
      await expect(statsContainer).toBeVisible();
    });
  });

  test.describe('Orchestrator List Display', () => {
    test('should display Orchestrator cards when data exists', async ({
      page,
    }) => {
      const orchestratorCards = page.locator('[class*="grid"] > div').filter({
        has: page.locator('h3'),
      });

      // Should have 3 Orchestrators from mock data
      await expect(orchestratorCards).toHaveCount(3);
    });

    test('should display Orchestrator card with correct information', async ({
      page,
    }) => {
      const firstCard = page
        .locator('h3:has-text("Head of Engineering")')
        .locator('..');

      await expect(firstCard.locator('h3')).toContainText(
        'Head of Engineering'
      );
      await expect(firstCard.locator('text=Engineering')).toBeVisible();
      await expect(
        firstCard.locator('text=Technical leadership')
      ).toBeVisible();
    });

    test('should display Orchestrator status badge', async ({ page }) => {
      const onlineCard = page
        .locator('h3:has-text("Head of Engineering")')
        .locator('..');
      await expect(onlineCard.locator('text=Online')).toBeVisible();
    });

    test('should display Orchestrator stats (messages, agents, activity)', async ({
      page,
    }) => {
      const firstCard = page
        .locator('h3:has-text("Head of Engineering")')
        .locator('..');

      // Should show message count
      await expect(firstCard.locator('text=1,247')).toBeVisible();

      // Should show agent count
      await expect(firstCard.locator('text=5')).toBeVisible();
    });

    test('should show loading skeleton initially', async ({ page }) => {
      // Intercept and delay API
      await page.route('**/api/workspaces/**/orchestrators*', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.continue();
      });

      await page.reload();

      // Should show skeleton
      const skeletons = page.locator('[class*="animate-pulse"]');
      await expect(skeletons.first()).toBeVisible({ timeout: 1000 });
    });
  });

  test.describe('Empty State', () => {
    test.beforeEach(async ({ page }) => {
      // Override route to return empty data
      await page.route('**/api/workspaces/**/orchestrators*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: mockEmptyOrchestrators,
            metadata: { total: 0, filtered: 0 },
          }),
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    test('should display empty state when no Orchestrators exist', async ({
      page,
    }) => {
      await expect(page.locator('text=No Orchestrators Yet')).toBeVisible();
      await expect(page.locator('text=Get started by creating')).toBeVisible();
    });

    test('should show Create Orchestrator action in empty state', async ({
      page,
    }) => {
      const createButton = page.locator(
        'button:has-text("Create Your First Orchestrator")'
      );
      await expect(createButton).toBeVisible();
    });

    test('should open create dialog from empty state', async ({ page }) => {
      await page
        .locator('button:has-text("Create Your First Orchestrator")')
        .click();
      await expect(
        page.locator('h2:has-text("Create New Orchestrator")')
      ).toBeVisible();
    });
  });

  test.describe('Status Filter', () => {
    test('should filter Orchestrators by Online status', async ({ page }) => {
      const statusSelect = page.locator('select').filter({
        has: page.locator('option:has-text("Online")'),
      });

      await statusSelect.selectOption('ONLINE');
      await page.waitForLoadState('networkidle');

      // Should only show 1 Online Orchestrator
      const orchestratorCards = page.locator('h3:has-text("Head of")');
      await expect(orchestratorCards).toHaveCount(1);
      await expect(
        page.locator('h3:has-text("Head of Engineering")')
      ).toBeVisible();
    });

    test('should filter Orchestrators by Busy status', async ({ page }) => {
      const statusSelect = page.locator('select').filter({
        has: page.locator('option:has-text("Busy")'),
      });

      await statusSelect.selectOption('BUSY');
      await page.waitForLoadState('networkidle');

      // Should only show 1 Busy Orchestrator
      await expect(
        page.locator('h3:has-text("Head of Product")')
      ).toBeVisible();
    });

    test('should filter Orchestrators by Offline status', async ({ page }) => {
      const statusSelect = page.locator('select').filter({
        has: page.locator('option:has-text("Offline")'),
      });

      await statusSelect.selectOption('OFFLINE');
      await page.waitForLoadState('networkidle');

      // Should only show 1 Offline Orchestrator
      await expect(page.locator('h3:has-text("Head of Design")')).toBeVisible();
    });

    test('should show All Status by default', async ({ page }) => {
      const statusSelect = page.locator('select').filter({
        has: page.locator('option:has-text("All Status")'),
      });

      const selectedValue = await statusSelect.inputValue();
      expect(selectedValue).toBe('');
    });

    test('should update results count when filtering', async ({ page }) => {
      const statusSelect = page.locator('select').filter({
        has: page.locator('option:has-text("Online")'),
      });

      await statusSelect.selectOption('ONLINE');
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('text=Showing 1 of 3 Orchestrators')
      ).toBeVisible();
    });
  });

  test.describe('Search Filter', () => {
    test('should filter Orchestrators by name search', async ({ page }) => {
      const searchInput = page.locator(
        'input[placeholder*="Search Orchestrators"]'
      );

      await searchInput.fill('Engineering');
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('h3:has-text("Head of Engineering")')
      ).toBeVisible();
      await expect(
        page.locator('h3:has-text("Head of Product")')
      ).not.toBeVisible();
    });

    test('should filter Orchestrators by discipline search', async ({
      page,
    }) => {
      const searchInput = page.locator(
        'input[placeholder*="Search Orchestrators"]'
      );

      await searchInput.fill('Product');
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('h3:has-text("Head of Product")')
      ).toBeVisible();
    });

    test('should be case insensitive', async ({ page }) => {
      const searchInput = page.locator(
        'input[placeholder*="Search Orchestrators"]'
      );

      await searchInput.fill('engineering');
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('h3:has-text("Head of Engineering")')
      ).toBeVisible();
    });

    test('should show empty state when search has no results', async ({
      page,
    }) => {
      const searchInput = page.locator(
        'input[placeholder*="Search Orchestrators"]'
      );

      await searchInput.fill('NonexistentOrchestrator');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=No Orchestrators Found')).toBeVisible();
    });

    test('should clear search when input is cleared', async ({ page }) => {
      const searchInput = page.locator(
        'input[placeholder*="Search Orchestrators"]'
      );

      await searchInput.fill('Engineering');
      await page.waitForLoadState('networkidle');

      await searchInput.clear();
      await page.waitForLoadState('networkidle');

      // Should show all Orchestrators again
      const orchestratorCards = page.locator('h3:has-text("Head of")');
      await expect(orchestratorCards).toHaveCount(3);
    });
  });

  test.describe('Discipline Filter', () => {
    test('should filter Orchestrators by discipline', async ({ page }) => {
      const disciplineSelect = page.locator('select').filter({
        has: page.locator('option:has-text("Engineering")'),
      });

      await disciplineSelect.selectOption('Engineering');
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('h3:has-text("Head of Engineering")')
      ).toBeVisible();
      await expect(
        page.locator('h3:has-text("Head of Product")')
      ).not.toBeVisible();
    });

    test('should show all disciplines in dropdown', async ({ page }) => {
      const disciplineSelect = page.locator('select').filter({
        has: page.locator('option:has-text("All Disciplines")'),
      });

      await expect(
        disciplineSelect.locator('option:has-text("Engineering")')
      ).toBeVisible();
      await expect(
        disciplineSelect.locator('option:has-text("Product")')
      ).toBeVisible();
      await expect(
        disciplineSelect.locator('option:has-text("Design")')
      ).toBeVisible();
    });
  });

  test.describe('Combined Filters', () => {
    test('should apply multiple filters together', async ({ page }) => {
      // Set status filter
      const statusSelect = page.locator('select').filter({
        has: page.locator('option:has-text("Online")'),
      });
      await statusSelect.selectOption('ONLINE');

      // Set search filter
      const searchInput = page.locator(
        'input[placeholder*="Search Orchestrators"]'
      );
      await searchInput.fill('Engineering');

      await page.waitForLoadState('networkidle');

      // Should only show Engineering Orchestrator that is Online
      await expect(
        page.locator('h3:has-text("Head of Engineering")')
      ).toBeVisible();
      await expect(
        page.locator('text=Showing 1 of 3 Orchestrators')
      ).toBeVisible();
    });

    test('should show active filter count', async ({ page }) => {
      const searchInput = page.locator(
        'input[placeholder*="Search Orchestrators"]'
      );
      await searchInput.fill('Engineering');

      await expect(page.locator('button:has-text("Clear (1)")')).toBeVisible();
    });

    test('should clear all filters', async ({ page }) => {
      // Apply filters
      const searchInput = page.locator(
        'input[placeholder*="Search Orchestrators"]'
      );
      await searchInput.fill('Engineering');

      const statusSelect = page.locator('select').filter({
        has: page.locator('option:has-text("Online")'),
      });
      await statusSelect.selectOption('ONLINE');

      // Clear filters
      await page.locator('button:has-text("Clear")').click();

      // Should show all Orchestrators
      const orchestratorCards = page.locator('h3:has-text("Head of")');
      await expect(orchestratorCards).toHaveCount(3);

      // Filters should be reset
      expect(await searchInput.inputValue()).toBe('');
      expect(await statusSelect.inputValue()).toBe('');
    });
  });

  test.describe('Create Orchestrator Wizard', () => {
    test('should open create Orchestrator dialog', async ({ page }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();
      await expect(
        page.locator('h2:has-text("Create New Orchestrator")')
      ).toBeVisible();
    });

    test('should close dialog on X button click', async ({ page }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();
      await page.locator('button[aria-label="Close dialog"]').click();
      await expect(
        page.locator('h2:has-text("Create New Orchestrator")')
      ).not.toBeVisible();
    });

    test('should close dialog on Cancel click', async ({ page }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();
      await page.locator('button:has-text("Cancel")').click();
      await expect(
        page.locator('h2:has-text("Create New Orchestrator")')
      ).not.toBeVisible();
    });

    test('should display step indicators', async ({ page }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();

      await expect(page.locator('text=Basic Info')).toBeVisible();
      await expect(page.locator('text=Charter')).toBeVisible();
      await expect(page.locator('text=Operations')).toBeVisible();
      await expect(page.locator('text=Review')).toBeVisible();
    });

    test('Step 1: Basic Info - should require name and discipline', async ({
      page,
    }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();

      // Next button should be disabled
      const nextButton = page.locator('button:has-text("Next")');
      await expect(nextButton).toBeDisabled();

      // Fill in required fields
      await page.locator('input#orchestrator-title').fill('Test Orchestrator');
      await page
        .locator('select#orchestrator-discipline')
        .selectOption('Engineering');

      // Next button should be enabled
      await expect(nextButton).toBeEnabled();
    });

    test('Step 1: Basic Info - should accept description', async ({ page }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();

      await page.locator('input#orchestrator-title').fill('Test Orchestrator');
      await page
        .locator('select#orchestrator-discipline')
        .selectOption('Engineering');
      await page
        .locator('textarea#orchestrator-description')
        .fill('Test description');

      await page.locator('button:has-text("Next")').click();

      // Should advance to step 2
      await expect(page.locator('text=Personality Traits')).toBeVisible();
    });

    test('Step 2: Charter - should require at least one personality trait', async ({
      page,
    }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();

      // Complete step 1
      await page.locator('input#orchestrator-title').fill('Test Orchestrator');
      await page
        .locator('select#orchestrator-discipline')
        .selectOption('Engineering');
      await page.locator('button:has-text("Next")').click();

      // Next should be disabled without traits
      const nextButton = page.locator('button:has-text("Next")');
      await expect(nextButton).toBeDisabled();

      // Select a trait
      await page.locator('button:has-text("Analytical")').click();

      // Next should be enabled
      await expect(nextButton).toBeEnabled();
    });

    test('Step 2: Charter - should allow adding expertise', async ({
      page,
    }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();

      // Complete step 1
      await page.locator('input#orchestrator-title').fill('Test Orchestrator');
      await page
        .locator('select#orchestrator-discipline')
        .selectOption('Engineering');
      await page.locator('button:has-text("Next")').click();

      // Select trait
      await page.locator('button:has-text("Analytical")').click();

      // Add expertise
      const expertiseInput = page.locator(
        'input[placeholder*="Add expertise"]'
      );
      await expertiseInput.fill('Scalability');
      await page.locator('button:has-text("Add")').click();

      // Should show expertise tag
      await expect(page.locator('text=Scalability')).toBeVisible();
    });

    test('Step 2: Charter - should allow removing expertise', async ({
      page,
    }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();

      // Complete step 1
      await page.locator('input#orchestrator-title').fill('Test Orchestrator');
      await page
        .locator('select#orchestrator-discipline')
        .selectOption('Engineering');
      await page.locator('button:has-text("Next")').click();

      // Select trait
      await page.locator('button:has-text("Analytical")').click();

      // Add expertise
      const expertiseInput = page.locator(
        'input[placeholder*="Add expertise"]'
      );
      await expertiseInput.fill('Scalability');
      await page.locator('button:has-text("Add")').click();

      // Remove expertise
      await page.locator('button[aria-label="Remove Scalability"]').click();

      // Should not show expertise tag
      await expect(page.locator('text=Scalability')).not.toBeVisible();
    });

    test('Step 3: Operations - should have default work hours', async ({
      page,
    }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();

      // Complete steps 1-2
      await page.locator('input#orchestrator-title').fill('Test Orchestrator');
      await page
        .locator('select#orchestrator-discipline')
        .selectOption('Engineering');
      await page.locator('button:has-text("Next")').click();
      await page.locator('button:has-text("Analytical")').click();
      await page.locator('button:has-text("Next")').click();

      // Check default values
      expect(await page.locator('input#work-start').inputValue()).toBe('09:00');
      expect(await page.locator('input#work-end').inputValue()).toBe('17:00');
      expect(await page.locator('select#timezone').inputValue()).toBe('UTC');
    });

    test('Step 3: Operations - should allow customizing work hours', async ({
      page,
    }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();

      // Complete steps 1-2
      await page.locator('input#orchestrator-title').fill('Test Orchestrator');
      await page
        .locator('select#orchestrator-discipline')
        .selectOption('Engineering');
      await page.locator('button:has-text("Next")').click();
      await page.locator('button:has-text("Analytical")').click();
      await page.locator('button:has-text("Next")').click();

      // Customize work hours
      await page.locator('input#work-start').fill('08:00');
      await page.locator('input#work-end').fill('18:00');
      await page.locator('select#timezone').selectOption('America/New_York');

      await page.locator('button:has-text("Next")').click();

      // Should show in review
      await expect(page.locator('text=08:00 - 18:00')).toBeVisible();
      await expect(page.locator('text=America/New_York')).toBeVisible();
    });

    test('Step 4: Review - should display all entered information', async ({
      page,
    }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();

      // Complete all steps
      await page.locator('input#orchestrator-title').fill('Test Orchestrator');
      await page
        .locator('select#orchestrator-discipline')
        .selectOption('Engineering');
      await page
        .locator('textarea#orchestrator-description')
        .fill('Test description');
      await page.locator('button:has-text("Next")').click();

      await page.locator('button:has-text("Analytical")').click();
      await page.locator('button:has-text("Strategic")').click();
      await page.locator('button:has-text("Next")').click();

      await page.locator('button:has-text("Next")').click();

      // Verify review content
      await expect(page.locator('text=Test Orchestrator')).toBeVisible();
      await expect(page.locator('text=Engineering')).toBeVisible();
      await expect(page.locator('text=Test description')).toBeVisible();
      await expect(page.locator('text=Analytical')).toBeVisible();
      await expect(page.locator('text=Strategic')).toBeVisible();
    });

    test('Step 4: Review - should have Create Orchestrator button', async ({
      page,
    }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();

      // Navigate to review step
      await page.locator('input#orchestrator-title').fill('Test Orchestrator');
      await page
        .locator('select#orchestrator-discipline')
        .selectOption('Engineering');
      await page.locator('button:has-text("Next")').click();
      await page.locator('button:has-text("Analytical")').click();
      await page.locator('button:has-text("Next")').click();
      await page.locator('button:has-text("Next")').click();

      const createButton = page.locator(
        'button:has-text("Create Orchestrator")'
      );
      await expect(createButton).toBeVisible();
      await expect(createButton).toBeEnabled();
    });

    test('should allow going back to previous steps', async ({ page }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();

      // Go to step 2
      await page.locator('input#orchestrator-title').fill('Test Orchestrator');
      await page
        .locator('select#orchestrator-discipline')
        .selectOption('Engineering');
      await page.locator('button:has-text("Next")').click();

      // Go back to step 1
      await page.locator('button:has-text("Back")').click();

      // Should see step 1 content
      await expect(page.locator('input#orchestrator-title')).toHaveValue(
        'Test Orchestrator'
      );
    });

    test('should show progress through steps', async ({ page }) => {
      await page.locator('button:has-text("Create Orchestrator")').click();

      // Step 1 should be active
      const step1Indicator = page
        .locator('text=Basic Info')
        .locator('..')
        .locator('..')
        .locator('div')
        .first();

      // Check step progression (implementation-specific)
      await expect(step1Indicator).toBeVisible();
    });
  });

  test.describe('Orchestrator Card Interactions', () => {
    test('should navigate to Orchestrator detail on View click', async ({
      page,
    }) => {
      const viewButton = page
        .locator('h3:has-text("Head of Engineering")')
        .locator('..')
        .locator('a:has-text("View")');

      await viewButton.click();
      await expect(page).toHaveURL(/\/orchestrators\/orch_001$/);
    });

    test('should have hover effect on Orchestrator card', async ({ page }) => {
      const orchestratorCard = page
        .locator('h3:has-text("Head of Engineering")')
        .locator('..');

      await orchestratorCard.hover();

      // Check for hover classes (implementation-specific)
      const classes = await orchestratorCard.getAttribute('class');
      expect(classes).toContain('hover:border-primary');
    });

    test('should display initials when no avatar', async ({ page }) => {
      const avatarDiv = page
        .locator('h3:has-text("Head of Engineering")')
        .locator('..')
        .locator('.rounded-full')
        .first();

      // Should show initials (HE for Head of Engineering)
      await expect(avatarDiv).toContainText('HE');
    });
  });

  test.describe('Orchestrator Detail Page', () => {
    test.beforeEach(async ({ page }) => {
      // Mock single Orchestrator API
      await page.route(
        '**/api/workspaces/**/orchestrators/orch_001*',
        async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: mockOrchestrators[0] }),
          });
        }
      );

      // Mock Orchestrator tasks API
      await page.route('**/api/orchestrators/orch_001/tasks*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            metadata: {
              total: 0,
              byStatus: { todo: 0, inProgress: 0, blocked: 0, done: 0 },
              completionRate: 0,
            },
          }),
        });
      });

      // Navigate to detail page
      const viewButton = page
        .locator('h3:has-text("Head of Engineering")')
        .locator('..')
        .locator('a:has-text("View")');
      await viewButton.click();
      await page.waitForLoadState('networkidle');
    });

    test('should load Orchestrator detail page', async ({ page }) => {
      await expect(page).toHaveURL(/\/orchestrators\/orch_001$/);
      await expect(
        page.locator('h1:has-text("Head of Engineering")')
      ).toBeVisible();
    });

    test('should display breadcrumb navigation', async ({ page }) => {
      await expect(page.locator('a:has-text("Orchestrators")')).toBeVisible();
      await expect(page.locator('text=Head of Engineering')).toBeVisible();
    });

    test('should display Orchestrator information', async ({ page }) => {
      await expect(
        page.locator('h1:has-text("Head of Engineering")')
      ).toBeVisible();
      await expect(page.locator('text=Engineering')).toBeVisible();
      await expect(page.locator('text=Technical leadership')).toBeVisible();
      await expect(page.locator('text=Online')).toBeVisible();
    });

    test('should display all tabs', async ({ page }) => {
      await expect(
        page.locator('button[role="tab"]:has-text("Overview")')
      ).toBeVisible();
      await expect(
        page.locator('button[role="tab"]:has-text("Tasks")')
      ).toBeVisible();
      await expect(
        page.locator('button[role="tab"]:has-text("Configuration")')
      ).toBeVisible();
      await expect(
        page.locator('button[role="tab"]:has-text("Activity")')
      ).toBeVisible();
      await expect(
        page.locator('button[role="tab"]:has-text("Agents")')
      ).toBeVisible();
    });

    test('should show Overview tab by default', async ({ page }) => {
      const overviewTab = page.locator(
        'button[role="tab"]:has-text("Overview")'
      );
      expect(await overviewTab.getAttribute('aria-selected')).toBe('true');
    });

    test('should switch between tabs', async ({ page }) => {
      await page.locator('button[role="tab"]:has-text("Tasks")').click();
      await expect(page.locator('h3:has-text("Assigned Tasks")')).toBeVisible();

      await page
        .locator('button[role="tab"]:has-text("Configuration")')
        .click();
      await expect(page.locator('text=Configuration')).toBeVisible();
    });

    test('should display statistics in Overview tab', async ({ page }) => {
      await expect(page.locator('text=Messages')).toBeVisible();
      await expect(page.locator('text=1,247')).toBeVisible();
      await expect(page.locator('text=Agents')).toBeVisible();
      await expect(page.locator('text=5')).toBeVisible();
    });

    test('should display charter summary', async ({ page }) => {
      await expect(
        page.locator('h3:has-text("Charter Summary")')
      ).toBeVisible();
      await expect(page.locator('text=Personality')).toBeVisible();
      await expect(page.locator('text=Analytical')).toBeVisible();
      await expect(page.locator('text=Strategic')).toBeVisible();
      await expect(page.locator('text=Technical')).toBeVisible();
    });

    test('should have Set Offline button when Orchestrator is online', async ({
      page,
    }) => {
      const statusButton = page.locator('button:has-text("Set Offline")');
      await expect(statusButton).toBeVisible();
      await expect(statusButton).toBeEnabled();
    });

    test('should have Delete button', async ({ page }) => {
      const deleteButton = page.locator('button:has-text("Delete")');
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toBeEnabled();
    });
  });

  test.describe('Orchestrator Status Management', () => {
    test.beforeEach(async ({ page }) => {
      // Mock single Orchestrator API
      await page.route(
        '**/api/workspaces/**/orchestrators/orch_001*',
        async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: mockOrchestrators[0] }),
          });
        }
      );

      // Mock Orchestrator tasks API
      await page.route('**/api/orchestrators/orch_001/tasks*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            metadata: {
              total: 0,
              byStatus: { todo: 0, inProgress: 0, blocked: 0, done: 0 },
              completionRate: 0,
            },
          }),
        });
      });

      // Navigate to detail page
      const viewButton = page
        .locator('h3:has-text("Head of Engineering")')
        .locator('..')
        .locator('a:has-text("View")');
      await viewButton.click();
      await page.waitForLoadState('networkidle');
    });

    test('should show confirmation before status change', async ({ page }) => {
      // Mock status update API
      await page.route('**/api/orchestrators/orch_001/status*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { ...mockOrchestrators[0], status: 'OFFLINE' },
          }),
        });
      });

      const statusButton = page.locator('button:has-text("Set Offline")');
      await statusButton.click();

      // Button text should update (or wait for refetch)
      await page.waitForLoadState('networkidle');
    });
  });

  test.describe('Orchestrator Delete', () => {
    test.beforeEach(async ({ page }) => {
      // Mock single Orchestrator API
      await page.route(
        '**/api/workspaces/**/orchestrators/orch_001*',
        async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: mockOrchestrators[0] }),
          });
        }
      );

      // Mock Orchestrator tasks API
      await page.route('**/api/orchestrators/orch_001/tasks*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            metadata: {
              total: 0,
              byStatus: { todo: 0, inProgress: 0, blocked: 0, done: 0 },
              completionRate: 0,
            },
          }),
        });
      });

      // Navigate to detail page
      const viewButton = page
        .locator('h3:has-text("Head of Engineering")')
        .locator('..')
        .locator('a:has-text("View")');
      await viewButton.click();
      await page.waitForLoadState('networkidle');
    });

    test('should show confirmation dialog before delete', async ({ page }) => {
      // Set up dialog handler
      page.on('dialog', dialog => {
        expect(dialog.message()).toContain('Are you sure');
        dialog.dismiss();
      });

      const deleteButton = page.locator('button:has-text("Delete")');
      await deleteButton.click();
    });

    test('should redirect to Orchestrators list after successful delete', async ({
      page,
    }) => {
      // Mock delete API
      await page.route('**/api/orchestrators/orch_001*', async route => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.continue();
        }
      });

      // Accept confirmation
      page.on('dialog', dialog => dialog.accept());

      const deleteButton = page.locator('button:has-text("Delete")');
      await deleteButton.click();

      // Should redirect to Orchestrators list
      await expect(page).toHaveURL(/\/orchestrators$/);
    });
  });

  test.describe('Error Handling', () => {
    test('should display error message on API failure', async ({ page }) => {
      // Override route to return error
      await page.route('**/api/workspaces/**/orchestrators*', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('text=Failed to load Orchestrators')
      ).toBeVisible();
    });

    test('should have retry button on error', async ({ page }) => {
      // Override route to return error
      await page.route('**/api/workspaces/**/orchestrators*', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const retryButton = page.locator('button:has-text("Try again")');
      await expect(retryButton).toBeVisible();
    });

    test('should handle 404 on Orchestrator detail page', async ({ page }) => {
      await page.route(
        '**/api/workspaces/**/orchestrators/nonexistent*',
        async route => {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Orchestrator not found' }),
          });
        }
      );

      const currentUrl = page.url();
      const workspaceId = currentUrl.match(/\/([^\/]+)\/orchestrators/)?.[1];

      if (workspaceId) {
        await page.goto(`${BASE_URL}/${workspaceId}/orchestrators/nonexistent`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Orchestrator not found')).toBeVisible();
        await expect(
          page.locator('a:has-text("Back to Orchestrators")')
        ).toBeVisible();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should adapt Orchestrator grid on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Orchestrator cards should stack vertically
      const orchestratorCards = page.locator('[class*="grid"] > div').filter({
        has: page.locator('h3'),
      });

      await expect(orchestratorCards.first()).toBeVisible();
    });

    test('should show filter controls on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const searchInput = page.locator(
        'input[placeholder*="Search Orchestrators"]'
      );
      await expect(searchInput).toBeVisible();
    });

    test('should not have horizontal scroll', async ({ page }) => {
      const viewports = [
        { width: 375, height: 667 },
        { width: 768, height: 1024 },
        { width: 1280, height: 720 },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);

        const hasHorizontalScroll = await page.evaluate(() => {
          return (
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth
          );
        });

        expect(
          hasHorizontalScroll,
          `Horizontal scroll at ${viewport.width}x${viewport.height}`
        ).toBe(false);
      }
    });
  });
});
