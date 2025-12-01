/**
 * Playwright MCP Test Template
 *
 * This template provides reusable patterns for browser automation testing
 * using the Playwright MCP server integrated with Claude.
 *
 * Setup:
 * 1. Ensure Neolith dev server is running: npm run dev
 * 2. Verify Playwright MCP is connected: claude mcp list
 * 3. Use these patterns in your tests
 */

/**
 * Base configuration for all tests
 * Note: This is a template file. To use with actual Playwright tests,
 * install @playwright/test package and import from it instead.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;

/**
 * Base configuration for all tests
 */
export const TEST_CONFIG = {
  BASE_URL: 'http://localhost:3000',
  TIMEOUT: 30000,
  WAIT_TIMEOUT: 5000,
  SCREENSHOT_DIR: './__tests__/screenshots',
};

/**
 * Test credentials (use environment variables in production)
 */
export const TEST_CREDENTIALS = {
  email: 'test@example.com',
  password: 'Test123!@#',
  workspaceId: 'test-workspace-001',
};

/**
 * Common selectors used across Neolith application
 */
export const SELECTORS = {
  // Auth page selectors
  AUTH: {
    loginEmail: 'input[name="email"]',
    loginPassword: 'input[name="password"]',
    loginButton: 'button[type="submit"]',
    registerLink: 'a[href="/register"]',
    loginLink: 'a[href="/login"]',
    errorMessage: '.error-message',
  },

  // Navigation selectors
  NAVIGATION: {
    sidebar: '.sidebar',
    mainNav: '.main-navigation',
    menuTrigger: 'button.menu-trigger',
    userMenu: '.user-menu',
    logoutButton: 'button[data-testid="logout"]',
  },

  // Dashboard selectors
  DASHBOARD: {
    title: 'h1',
    actionButton: 'button.action-button',
    card: '.dashboard-card',
    widget: '.widget',
  },

  // Form selectors
  FORM: {
    input: 'input[type="text"]',
    emailInput: 'input[type="email"]',
    passwordInput: 'input[type="password"]',
    textArea: 'textarea',
    submitButton: 'button[type="submit"]',
    cancelButton: 'button[data-testid="cancel"]',
  },

  // Modal/Dialog selectors
  MODAL: {
    modal: '.modal, [role="dialog"]',
    overlay: '.modal-overlay',
    closeButton: 'button.close, button[aria-label="Close"]',
    confirmButton: 'button[data-testid="confirm"]',
  },

  // List/Table selectors
  LIST: {
    listItem: '[role="listitem"], .list-item',
    tableRow: 'tr',
    tableCell: 'td',
  },
};

/**
 * Helper: Navigate to a specific route
 * @param page - Playwright page object
 * @param path - Route path (e.g., '/login', '/dashboard')
 */
export async function navigateToRoute(page: Page, path: string): Promise<void> {
  const url = `${TEST_CONFIG.BASE_URL}${path}`;
  console.log(`Navigating to: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });
}

/**
 * Helper: Fill login form
 * @param page - Playwright page object
 * @param email - Email address
 * @param password - Password
 */
export async function fillLoginForm(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  console.log('Filling login form...');
  await page.fill(SELECTORS.AUTH.loginEmail, email);
  await page.fill(SELECTORS.AUTH.loginPassword, password);
  console.log('Login form filled');
}

/**
 * Helper: Submit login form
 * @param page - Playwright page object
 */
export async function submitLoginForm(page: Page): Promise<void> {
  console.log('Submitting login form...');
  await page.click(SELECTORS.AUTH.loginButton);
  await page.waitForNavigation({ waitUntil: 'networkidle' });
  console.log('Login submitted and navigation complete');
}

/**
 * Helper: Login user (combined flow)
 * @param page - Playwright page object
 * @param email - Email address
 * @param password - Password
 */
export async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await navigateToRoute(page, '/login');
  await fillLoginForm(page, email, password);
  await submitLoginForm(page);
}

/**
 * Helper: Take screenshot with consistent naming
 * @param page - Playwright page object
 * @param name - Screenshot name
 * @param directory - Optional directory (relative to project root)
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  directory: string = TEST_CONFIG.SCREENSHOT_DIR
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `${name}_${timestamp}.png`;
  const filepath = `${directory}/${filename}`;

  console.log(`Taking screenshot: ${filepath}`);
  await page.screenshot({ path: filepath, fullPage: true });

  return filepath;
}

/**
 * Helper: Wait for element and get text
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param timeout - Wait timeout in ms
 */
export async function getElementText(
  page: Page,
  selector: string,
  timeout: number = TEST_CONFIG.WAIT_TIMEOUT
): Promise<string> {
  await page.waitForSelector(selector, { timeout });
  const text = await page.textContent(selector);
  return text || '';
}

/**
 * Helper: Wait for element and click
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param timeout - Wait timeout in ms
 */
export async function clickElement(
  page: Page,
  selector: string,
  timeout: number = TEST_CONFIG.WAIT_TIMEOUT
): Promise<void> {
  console.log(`Clicking element: ${selector}`);
  await page.waitForSelector(selector, { timeout });
  await page.click(selector);
}

/**
 * Helper: Fill form field
 * @param page - Playwright page object
 * @param selector - CSS selector
 * @param value - Value to fill
 * @param timeout - Wait timeout in ms
 */
export async function fillField(
  page: Page,
  selector: string,
  value: string,
  timeout: number = TEST_CONFIG.WAIT_TIMEOUT
): Promise<void> {
  console.log(`Filling field: ${selector} with value: ${value}`);
  await page.waitForSelector(selector, { timeout });
  await page.fill(selector, value);
}

/**
 * Helper: Verify element is visible
 * @param page - Playwright page object
 * @param selector - CSS selector
 */
export async function isElementVisible(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    const element = await page.$(selector);
    if (!element) {
      return false;
    }
    return await element.isVisible();
  } catch {
    return false;
  }
}

/**
 * Helper: Query all elements matching selector
 * @param page - Playwright page object
 * @param selector - CSS selector
 */
export async function queryElements(
  page: Page,
  selector: string
): Promise<string[]> {
  console.log(`Querying elements: ${selector}`);
  const elements = await page.locator(selector).all();
  const texts: string[] = [];

  for (const element of elements) {
    const text = await element.textContent();
    if (text) {
      texts.push(text.trim());
    }
  }

  console.log(`Found ${texts.length} elements`);
  return texts;
}

/**
 * Helper: Get current page URL
 * @param page - Playwright page object
 */
export async function getCurrentUrl(page: Page): Promise<string> {
  return page.url();
}

/**
 * Helper: Get page title
 * @param page - Playwright page object
 */
export async function getPageTitle(page: Page): Promise<string> {
  return page.title();
}

/**
 * Helper: Wait for page load state
 * @param page - Playwright page object
 * @param state - Load state ('domcontentloaded', 'load', 'networkidle')
 */
export async function waitForLoadState(
  page: Page,
  state: 'domcontentloaded' | 'load' | 'networkidle' = 'networkidle'
): Promise<void> {
  console.log(`Waiting for load state: ${state}`);
  await page.waitForLoadState(state);
}

/**
 * Helper: Clear browser cookies and reload
 * @param page - Playwright page object
 */
export async function clearAndReload(page: Page): Promise<void> {
  const context = page.context();
  await context.clearCookies();
  await page.reload({ waitUntil: 'networkidle' });
}

/**
 * Helper: Set authentication cookies
 * @param page - Playwright page object
 * @param cookies - Array of cookies
 */
export async function setCookies(
  page: Page,
  cookies: Array<{ name: string; value: string }>
): Promise<void> {
  const context = page.context();
  const cookiesList = cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    url: TEST_CONFIG.BASE_URL,
  }));
  await context.addCookies(cookiesList);
}

/**
 * Helper: Test complete user flow
 * @param page - Playwright page object
 * @param steps - Array of step functions
 */
export async function executeFlow(
  page: Page,
  steps: Array<(page: Page) => Promise<void>>
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    console.log(`Executing step ${i + 1} of ${steps.length}`);
    await steps[i](page);
  }
  console.log('Flow execution complete');
}

/**
 * Helper: Create workspace creation flow
 * Used for testing workspace creation functionality
 */
export async function createWorkspaceFlow(page: Page): Promise<void> {
  const steps: Array<(page: Page) => Promise<void>> = [
    async p => {
      await navigateToRoute(p, '/dashboard');
      await waitForLoadState(p, 'networkidle');
    },
    async p => {
      // Look for "Create Workspace" button
      const createButton = await p.$('button:has-text("Create Workspace")');
      if (createButton) {
        await clickElement(p, 'button:has-text("Create Workspace")');
      }
    },
    async p => {
      // Fill workspace form
      await fillField(p, 'input[name="workspace-name"]', 'Test Workspace');
      await fillField(
        p,
        'textarea[name="description"]',
        'Test workspace description'
      );
    },
    async p => {
      // Submit form
      await clickElement(p, 'button[type="submit"]');
      await waitForLoadState(p, 'networkidle');
    },
    async p => {
      // Take final screenshot
      await takeScreenshot(p, 'workspace_created');
    },
  ];

  await executeFlow(page, steps);
}

/**
 * Jest Test Suite Example
 * Uncomment to use with Jest test runner
 */
/*
describe('Neolith Playwright MCP Tests', () => {
  let page: Page;

  beforeEach(async () => {
    // Initialize page and navigate to base URL
  });

  afterEach(async () => {
    // Clean up
  });

  it('should load login page', async () => {
    await navigateToRoute(page, '/login');
    const isVisible = await isElementVisible(page, SELECTORS.AUTH.loginEmail);
    expect(isVisible).toBe(true);
  });

  it('should navigate to dashboard after login', async () => {
    await loginUser(page, TEST_CREDENTIALS.email, TEST_CREDENTIALS.password);
    const url = await getCurrentUrl(page);
    expect(url).toContain('/dashboard');
  });
});
*/

export default {
  TEST_CONFIG,
  TEST_CREDENTIALS,
  SELECTORS,
  navigateToRoute,
  fillLoginForm,
  submitLoginForm,
  loginUser,
  takeScreenshot,
  getElementText,
  clickElement,
  fillField,
  isElementVisible,
  queryElements,
  getCurrentUrl,
  getPageTitle,
  waitForLoadState,
  clearAndReload,
  setCookies,
  executeFlow,
  createWorkspaceFlow,
};
