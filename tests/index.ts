/**
 * Playwright Test Template Library Index
 *
 * Main entry point for all test templates and helpers.
 * Import templates and helpers from this file for consistent access.
 */

// ============================================================================
// Test Templates
// ============================================================================

// Page Load Template
export {
  pageLoadTemplate,
  getPageLoadMetrics,
  waitForPageInteractive,
  type PageLoadConfig,
} from './templates/page-load.template';

// Form Submission Template
export {
  formSubmissionTemplate,
  clearForm,
  getFormFieldValue,
  expectFieldDisabled,
  expectFieldEnabled,
  type FormField,
  type FormValidationRule,
  type FormSubmissionConfig,
} from './templates/form-submission.template';

// Responsive Breakpoints Template
export {
  responsiveBreakpointsTemplate,
  testBreakpoint,
  getElementVisibilityAtBreakpoint,
  getLayoutShiftScore,
  type ResponsiveBreakpointsConfig,
  type Breakpoint,
} from './templates/responsive-breakpoints.template';

// Empty State Template
export {
  emptyStateTemplate,
  verifyEmptyStateCTAClickable,
  clickEmptyStateCTA,
  getEmptyStateContent,
  type EmptyStateConfig,
  type EmptyStateIndicators,
} from './templates/empty-state.template';

// Skeleton Loader Template
export {
  skeletonLoaderTemplate,
  waitForSkeletonToDisappear,
  waitForContentToAppear,
  measureSkeletonTransitionTime,
  verifySkeletonContentCount,
  getSkeletons,
  type SkeletonLoaderConfig,
} from './templates/skeleton-loader.template';

// Theme Switching Template
export {
  themeSwitchingTemplate,
  getCurrentTheme,
  setTheme,
  getCSSVariable,
  getThemeScreenshot,
  type ThemeSwitchingConfig,
} from './templates/theme-switching.template';

// Error Handling Template
export {
  errorHandlingTemplate,
  triggerNetworkError,
  triggerTimeoutError,
  mockErrorResponse,
  getErrorDetails,
  verifyNoConsoleErrors,
  expectErrorMessage,
  type ErrorHandlingConfig,
  type ErrorIndicators,
} from './templates/error-handling.template';

// ============================================================================
// Helper Functions
// ============================================================================

// Common Fixtures
export {
  TEST_USERS,
  TEST_DATA,
  COMMON_SELECTORS,
  waitForElement,
  waitForElementToDisappear,
  waitForNavigation,
  isElementVisible,
  isElementEnabled,
  getElementText,
  getElementValue,
  fillForm,
  submitForm,
  waitForRequest,
  waitForResponse,
  mockAPI,
  setLocalStorage,
  getLocalStorage,
  clearLocalStorage,
  setCookie,
  getCookie,
  clearCookies,
  checkPageAccessibility,
  takeScreenshot,
  compareScreenshots,
  measurePageLoadTime,
  getWebVitals,
  triggerEvent,
  hoverElement,
  focusElement,
  getCacheStorage,
  getSessionStorage,
} from './helpers/common-fixtures';

// Test Setup
export {
  TEST_CONFIG,
  setupTestPage,
  setupAuthentication,
  setupMockAPIs,
  setupErrorHandling,
  cleanupTest,
  retryTest,
  expectElementExists,
  expectElementNotExists,
  expectNavigationTo,
  waitForImagesToLoad,
  waitForNetworkIdle,
  injectTestUtils,
  callPageTestUtil,
} from './helpers/test-setup';

// ============================================================================
// Documentation and Guide
// ============================================================================

/**
 * QUICK START GUIDE
 *
 * 1. Import templates:
 *    import { pageLoadTemplate, formSubmissionTemplate } from '@/tests';
 *
 * 2. Setup test page:
 *    test.beforeEach(async ({ page }) => {
 *      await setupTestPage(page);
 *    });
 *
 * 3. Use templates:
 *    test('loads page', async ({ page }) => {
 *      await pageLoadTemplate(page, {
 *        url: '/',
 *        expectedElements: ['[data-testid="header"]']
 *      });
 *    });
 *
 * For detailed guide, see: TEMPLATE_USAGE_GUIDE.md
 */

/**
 * TEMPLATE CATEGORIES
 *
 * Page Load:
 *   - pageLoadTemplate: Verify page loads correctly
 *   - getPageLoadMetrics: Get performance metrics
 *   - waitForPageInteractive: Wait for full interactivity
 *
 * Forms:
 *   - formSubmissionTemplate: Test form submission flows
 *   - clearForm: Reset form to initial state
 *   - getFormFieldValue: Get current field value
 *
 * Responsive Design:
 *   - responsiveBreakpointsTemplate: Test multiple screen sizes
 *   - testBreakpoint: Test specific breakpoint
 *   - getLayoutShiftScore: Measure layout stability
 *
 * Empty States:
 *   - emptyStateTemplate: Verify empty state displays
 *   - getEmptyStateContent: Extract empty state text
 *   - clickEmptyStateCTA: Click call-to-action
 *
 * Loading States:
 *   - skeletonLoaderTemplate: Test skeleton/loading states
 *   - waitForSkeletonToDisappear: Wait for content load
 *   - measureSkeletonTransitionTime: Measure load performance
 *
 * Theme Switching:
 *   - themeSwitchingTemplate: Test theme switching
 *   - getCurrentTheme: Get active theme
 *   - getCSSVariable: Get theme CSS variable
 *
 * Error Handling:
 *   - errorHandlingTemplate: Test error states
 *   - triggerNetworkError: Mock network failure
 *   - getErrorDetails: Extract error information
 *
 * Common Helpers:
 *   - setupTestPage: Initialize test environment
 *   - setupAuthentication: Setup user auth
 *   - setupMockAPIs: Mock API responses
 *   - fillForm: Fill form fields
 *   - mockAPI: Mock specific endpoint
 *   - checkPageAccessibility: Verify a11y
 *   - measurePageLoadTime: Get load metrics
 */

/**
 * FILE STRUCTURE
 *
 * tests/
 * ├── templates/                 # Template library
 * │   ├── page-load.template.ts
 * │   ├── form-submission.template.ts
 * │   ├── responsive-breakpoints.template.ts
 * │   ├── empty-state.template.ts
 * │   ├── skeleton-loader.template.ts
 * │   ├── theme-switching.template.ts
 * │   └── error-handling.template.ts
 * │
 * ├── helpers/                   # Helper functions
 * │   ├── common-fixtures.ts     # Common utilities
 * │   └── test-setup.ts          # Setup/teardown
 * │
 * ├── e2e/                       # Example tests
 * │   ├── example-dashboard.spec.ts
 * │   ├── example-form.spec.ts
 * │   └── [your-tests].spec.ts
 * │
 * ├── fixtures/                  # Test data (optional)
 * │   └── [test-data].json
 * │
 * ├── index.ts                   # This file
 * ├── TEMPLATE_USAGE_GUIDE.md    # Complete guide
 * └── playwright.config.ts       # Playwright config
 */

/**
 * BEST PRACTICES
 *
 * 1. Use meaningful test names
 *    ✓ "form submits with valid email and password"
 *    ✗ "form test"
 *
 * 2. Use data-testid selectors
 *    ✓ '[data-testid="submit-button"]'
 *    ✗ '.primary-btn' or 'button:nth-child(2)'
 *
 * 3. Setup/teardown properly
 *    - Clear storage in beforeEach
 *    - Clean up timers in afterEach
 *
 * 4. Avoid hard-coded waits
 *    ✓ await page.waitForSelector(selector)
 *    ✗ await page.waitForTimeout(2000)
 *
 * 5. Use templates for common patterns
 *    ✓ Use pageLoadTemplate for page load tests
 *    ✗ Write page load checks manually
 *
 * 6. Verify without assertions
 *    ✓ Use template functions that verify
 *    ✗ Manually check every condition
 *
 * 7. Mock external APIs
 *    ✓ Use setupMockAPIs() for dependencies
 *    ✗ Call real APIs in tests
 *
 * 8. Use meaningful error messages
 *    ✓ expect(result).toBe(true, 'Form should submit successfully')
 *    ✗ expect(result).toBe(true)
 */

/**
 * COMMON TEST PATTERNS
 *
 * Authentication Flow:
 *   1. setupTestPage(page)
 *   2. setupAuthentication(page, token)
 *   3. page.goto(protectedUrl)
 *   4. Verify authenticated content
 *
 * Form Submission:
 *   1. formSubmissionTemplate(page, config)
 *   2. Verify success state
 *   3. Verify data persisted
 *
 * Responsive Design:
 *   1. responsiveBreakpointsTemplate(page, config)
 *   2. Verify layout adapts
 *   3. Verify touch targets
 *
 * Error Handling:
 *   1. errorHandlingTemplate(page, config)
 *   2. Verify error message
 *   3. Verify recovery action
 *
 * Loading States:
 *   1. skeletonLoaderTemplate(page, config)
 *   2. Verify skeleton visible
 *   3. Verify content loads
 *
 * Empty States:
 *   1. emptyStateTemplate(page, config)
 *   2. Verify empty message
 *   3. Verify CTA works
 */

/**
 * RUNNING TESTS
 *
 * All tests:
 *   npm test
 *
 * Specific file:
 *   npm test -- example-dashboard.spec.ts
 *
 * Specific test:
 *   npm test -- -g "loads page"
 *
 * With UI:
 *   npm test -- --ui
 *
 * Debug mode:
 *   npm test -- --debug
 *
 * Update snapshots:
 *   npm test -- --update-snapshots
 */

/**
 * TROUBLESHOOTING
 *
 * Q: Test times out
 * A: Increase timeout, check selectors, verify mock APIs
 *
 * Q: Element not found
 * A: Check data-testid attributes, verify element visibility
 *
 * Q: Flaky test
 * A: Use retry helper, avoid hard waits, wait for elements
 *
 * Q: Form not submitting
 * A: Check submit button is visible, verify form data, check for errors
 *
 * See TEMPLATE_USAGE_GUIDE.md for more troubleshooting tips
 */

// Export types
export type {
  PageLoadConfig,
  FormField,
  FormValidationRule,
  FormSubmissionConfig,
  ResponsiveBreakpointsConfig,
  Breakpoint,
  EmptyStateConfig,
  SkeletonLoaderConfig,
  ThemeSwitchingConfig,
  ErrorHandlingConfig,
} from './templates/page-load.template';
