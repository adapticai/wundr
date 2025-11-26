# Playwright Test Template Library

Complete guide to using reusable test templates for Neolith testing.

## Quick Start

### Installation

The test templates are ready to use in `/tests/templates/`. Import them directly into your test files:

```typescript
import { pageLoadTemplate } from '@/templates/page-load.template';
import { formSubmissionTemplate } from '@/templates/form-submission.template';
import { responsiveBreakpointsTemplate } from '@/templates/responsive-breakpoints.template';
```

### Basic Example

```typescript
import { test } from '@playwright/test';
import { pageLoadTemplate } from '@/templates/page-load.template';

test('dashboard loads correctly', async ({ page }) => {
  await pageLoadTemplate(page, {
    url: '/dashboard',
    expectedTitle: 'Dashboard',
    expectedElements: ['[data-testid="header"]', '[data-testid="sidebar"]'],
    maxLoadTime: 3000,
  });
});
```

## Available Templates

### 1. Page Load Template

Tests page load performance, rendering, and critical content visibility.

**File**: `templates/page-load.template.ts`

**Features**:
- Navigate to page and verify successful load
- Validate page title
- Check all expected elements are visible
- Measure and validate load time
- Verify no JavaScript errors
- Check for failed requests (404, 500)

**Usage**:

```typescript
import { pageLoadTemplate, getPageLoadMetrics, waitForPageInteractive } from '@/templates/page-load.template';

test('home page loads with all critical elements', async ({ page }) => {
  await pageLoadTemplate(page, {
    url: '/',
    expectedTitle: /Home|Dashboard/i,
    expectedElements: [
      '[data-testid="navigation"]',
      '[data-testid="main-content"]',
      '[data-testid="footer"]',
    ],
    maxLoadTime: 3000,
    waitForSelector: '[data-testid="main-content"]',
    expectNetworkIdle: true,
  });

  // Get performance metrics
  const metrics = await getPageLoadMetrics(page);
  console.log('DOM Content Loaded:', metrics.domContentLoaded);
  console.log('Load Complete:', metrics.loadComplete);
  console.log('First Paint:', metrics.firstPaint);

  // Wait for page to be fully interactive
  await waitForPageInteractive(page);
});
```

**API**:

```typescript
interface PageLoadConfig {
  url: string;
  expectedTitle?: string | RegExp;
  expectedElements?: string[];
  maxLoadTime?: number; // milliseconds
  waitForSelector?: string;
  expectNetworkIdle?: boolean;
}
```

---

### 2. Form Submission Template

Tests form validation, submission, and success/error handling.

**File**: `templates/form-submission.template.ts`

**Features**:
- Fill form fields with various types (text, email, checkbox, select, etc.)
- Validate form field interactions
- Test validation rules and error messages
- Submit form and verify success/error states
- Support for before/after submission hooks

**Usage**:

```typescript
import { formSubmissionTemplate, clearForm, getFormFieldValue } from '@/templates/form-submission.template';

test('login form works correctly', async ({ page }) => {
  await page.goto('/login');

  await formSubmissionTemplate(page, {
    formSelector: 'form[data-testid="login-form"]',
    fields: [
      { selector: 'input[name="email"]', value: 'user@example.com', type: 'email' },
      { selector: 'input[name="password"]', value: 'password123', type: 'password' },
    ],
    submitButtonSelector: 'button[type="submit"]',
    validationRules: [
      {
        fieldSelector: 'input[name="email"]',
        triggerEvent: 'blur',
        expectedErrorSelector: '[data-testid="email-error"]',
      },
    ],
    expectedSuccessIndicator: '/dashboard',
    successTimeout: 5000,
    expectSuccess: true,
    expectedUrl: '/dashboard',
    beforeSubmit: async (page) => {
      console.log('About to submit form');
    },
    afterSubmit: async (page) => {
      console.log('Form submitted successfully');
    },
  });

  // Helper functions
  const emailValue = await getFormFieldValue(page, 'input[name="email"]');
  console.log('Email value:', emailValue);

  // Clear form for next test
  await clearForm(page, 'form[data-testid="login-form"]');
});
```

**API**:

```typescript
interface FormField {
  selector: string;
  value: string | number;
  type?: 'text' | 'email' | 'password' | 'number' | 'checkbox' | 'radio' | 'select' | 'textarea';
  clearFirst?: boolean;
}

interface FormValidationRule {
  fieldSelector: string;
  triggerEvent?: 'blur' | 'change' | 'input';
  expectedErrorMessage?: string | RegExp;
  expectedErrorSelector?: string;
}

interface FormSubmissionConfig {
  formSelector: string;
  fields: FormField[];
  submitButtonSelector: string;
  expectedSuccessIndicator?: string | RegExp;
  expectedErrorIndicator?: string | RegExp;
  successTimeout?: number;
  errorTimeout?: number;
  validationRules?: FormValidationRule[];
  beforeSubmit?: (page: Page) => Promise<void>;
  afterSubmit?: (page: Page) => Promise<void>;
  expectSuccess?: boolean;
  expectedUrl?: string | RegExp;
}
```

---

### 3. Responsive Breakpoints Template

Tests responsive design across multiple screen sizes and device types.

**File**: `templates/responsive-breakpoints.template.ts`

**Features**:
- Test multiple breakpoints (mobile, tablet, desktop, wide)
- Verify element visibility at different screen sizes
- Check layout shift (CLS)
- Validate text readability
- Check touch target sizes for mobile
- Support for custom breakpoints

**Usage**:

```typescript
import { responsiveBreakpointsTemplate, testBreakpoint, getLayoutShiftScore } from '@/templates/responsive-breakpoints.template';

test('dashboard is responsive', async ({ page }) => {
  await page.goto('/dashboard');

  await responsiveBreakpointsTemplate(page, {
    url: '/dashboard',
    breakpoints: ['mobile', 'tablet', 'desktop'],
    elementVisibility: {
      mobile: {
        visible: ['[data-testid="mobile-nav"]'],
        hidden: ['[data-testid="desktop-nav"]'],
      },
      tablet: {
        visible: ['[data-testid="main-content"]'],
        hidden: [],
      },
      desktop: {
        visible: ['[data-testid="desktop-nav"]', '[data-testid="sidebar"]'],
        hidden: ['[data-testid="mobile-nav"]'],
      },
    },
    noLayoutShift: true,
    checkTextReadability: true,
    checkTouchTargets: true,
    minTouchTargetSize: 44, // pixels
    onBreakpointChange: async (breakpoint) => {
      console.log(`Testing breakpoint: ${breakpoint.name}`);
    },
  });

  // Get layout shift score
  const clsScore = await getLayoutShiftScore(page);
  console.log('Cumulative Layout Shift:', clsScore);
});
```

**Predefined Breakpoints**:

- `mobile`: 375x667 (Pixel 5)
- `tablet`: 768x1024 (iPad)
- `desktop`: 1280x720 (Desktop)
- `wide`: 1920x1080 (4K)

**API**:

```typescript
interface ResponsiveBreakpointsConfig {
  url: string;
  breakpoints?: BreakpointName[] | Breakpoint[];
  elementVisibility?: Record<BreakpointName, BreakpointVisibility>;
  customBreakpoints?: Breakpoint[];
  noLayoutShift?: boolean;
  checkTextReadability?: boolean;
  checkTouchTargets?: boolean;
  minTouchTargetSize?: number;
  onBreakpointChange?: (breakpoint: Breakpoint) => Promise<void>;
}
```

---

### 4. Empty State Template

Tests empty state displays when no data is available.

**File**: `templates/empty-state.template.ts`

**Features**:
- Verify empty state elements are visible
- Validate empty state text and messages
- Check call-to-action button
- Verify no data elements are hidden
- Check accessibility and contrast

**Usage**:

```typescript
import { emptyStateTemplate, clickEmptyStateCTA, getEmptyStateContent } from '@/templates/empty-state.template';

test('shows empty state when no items', async ({ page }) => {
  await emptyStateTemplate(page, {
    url: '/items?empty=true',
    emptyIndicators: {
      visible: ['[data-testid="empty-state"]', '[data-testid="empty-icon"]'],
      hidden: ['[data-testid="items-list"]'],
    },
    expectedText: /No items found|Your list is empty/i,
    expectedImage: 'empty-box',
    expectedCTA: {
      selector: '[data-testid="create-item-button"]',
      expectedText: /Create item|Add new/i,
      isDisabled: false,
    },
    expectedSubtext: /Start by creating your first item/i,
    checkAccessibility: true,
    checkContrast: true,
  });

  // Get empty state content
  const content = await getEmptyStateContent(page);
  console.log('Empty state title:', content.title);
  console.log('Empty state description:', content.description);

  // Click CTA and verify navigation
  await clickEmptyStateCTA(page, '[data-testid="create-item-button"]', '/items/create');
});
```

**API**:

```typescript
interface EmptyStateConfig {
  url: string;
  emptyIndicators: EmptyStateIndicators;
  expectedText?: string | RegExp;
  expectedImage?: string;
  expectedCTA?: CTAConfig;
  expectedSubtext?: string | RegExp;
  checkAccessibility?: boolean;
  checkContrast?: boolean;
}
```

---

### 5. Skeleton Loader Template

Tests loading states, skeleton screens, and transitions to loaded content.

**File**: `templates/skeleton-loader.template.ts`

**Features**:
- Verify skeleton elements appear during loading
- Check for loading spinners or messages
- Validate transition from skeleton to content
- Verify skeleton animations
- Check accessibility of loading states
- Measure transition time

**Usage**:

```typescript
import {
  skeletonLoaderTemplate,
  waitForSkeletonToDisappear,
  measureSkeletonTransitionTime,
  getSkeletons,
} from '@/templates/skeleton-loader.template';

test('shows skeleton while loading data', async ({ page }) => {
  await skeletonLoaderTemplate(page, {
    url: '/dashboard',
    skeletonSelectors: ['[data-testid="card-skeleton"]', '[data-testid="table-skeleton"]'],
    contentSelectors: ['[data-testid="card"]', '[data-testid="table"]'],
    shouldShow: 'both', // 'skeletons' | 'content' | 'both'
    spinnerSelector: '[data-testid="loading-spinner"]',
    loadingMessage: /Loading|Please wait/i,
    transitionTimeout: 5000,
    checkAnimations: true,
    checkAccessibility: true,
    onSkeletonVisible: async (page) => {
      console.log('Skeleton is visible');
    },
    onContentVisible: async (page) => {
      console.log('Content loaded');
    },
  });

  // Measure transition time
  const transitionTime = await measureSkeletonTransitionTime(
    page,
    '[data-testid="card-skeleton"]',
    '[data-testid="card"]'
  );
  console.log('Skeleton transition time:', transitionTime, 'ms');

  // Get skeleton list
  const skeletons = await getSkeletons(page, '[data-testid="card-skeleton"]');
  console.log('Skeleton count:', skeletons.count);
  console.log('Has animations:', skeletons.hasAnimation);
});
```

**API**:

```typescript
interface SkeletonLoaderConfig {
  url: string;
  skeletonSelectors: string[];
  contentSelectors: string[];
  shouldShow: 'skeletons' | 'content' | 'both';
  spinnerSelector?: string;
  loadingMessage?: string | RegExp;
  transitionTimeout?: number;
  checkAnimations?: boolean;
  checkAccessibility?: boolean;
  onSkeletonVisible?: (page: Page) => Promise<void>;
  onContentVisible?: (page: Page) => Promise<void>;
}
```

---

### 6. Theme Switching Template

Tests theme switching, persistence, and visual consistency.

**File**: `templates/theme-switching.template.ts`

**Features**:
- Test switching between themes (light, dark, etc.)
- Verify theme colors are applied correctly
- Check theme persistence (localStorage/sessionStorage)
- Validate text contrast in each theme
- Check CSS variables are set
- Verify font legibility

**Usage**:

```typescript
import {
  themeSwitchingTemplate,
  getCurrentTheme,
  setTheme,
  getCSSVariable,
} from '@/templates/theme-switching.template';

test('theme switching works and persists', async ({ page }) => {
  await themeSwitchingTemplate(page, {
    url: '/dashboard',
    themeToggleSelector: '[data-testid="theme-toggle"]',
    themes: ['light', 'dark'],
    colorChecks: {
      light: {
        background: 'rgb(255, 255, 255)',
        text: 'rgb(0, 0, 0)',
      },
      dark: {
        background: 'rgb(15, 23, 42)',
        text: 'rgb(255, 255, 255)',
      },
    },
    persistenceEnabled: true,
    persistenceKey: 'theme',
    elementsToCheck: ['body', '[role="main"]'],
    checkContrast: true,
    checkFontLegibility: true,
    beforeThemeSwitch: async (page, theme) => {
      console.log(`Switching to ${theme} theme`);
    },
    afterThemeSwitch: async (page, theme) => {
      console.log(`Switched to ${theme} theme`);
    },
  });

  // Get current theme
  const currentTheme = await getCurrentTheme(page, 'theme');
  console.log('Current theme:', currentTheme);

  // Set theme manually
  await setTheme(page, 'dark', 'theme');

  // Get CSS variable
  const primaryColor = await getCSSVariable(page, '--color-primary');
  console.log('Primary color:', primaryColor);
});
```

**API**:

```typescript
interface ThemeSwitchingConfig {
  url: string;
  themeToggleSelector: string;
  themes: string[];
  colorChecks?: Record<string, ColorSpec>;
  persistenceEnabled?: boolean;
  persistenceKey?: string;
  elementsToCheck?: string[];
  beforeThemeSwitch?: (page: Page, theme: string) => Promise<void>;
  afterThemeSwitch?: (page: Page, theme: string) => Promise<void>;
  checkContrast?: boolean;
  checkFontLegibility?: boolean;
}
```

---

### 7. Error Handling Template

Tests error pages, error messages, error recovery, and error boundaries.

**File**: `templates/error-handling.template.ts`

**Features**:
- Test error page displays
- Verify error codes and messages
- Check error recovery actions
- Validate error accessibility
- Test error boundaries
- Mock network errors

**Usage**:

```typescript
import {
  errorHandlingTemplate,
  triggerNetworkError,
  getErrorDetails,
  expectErrorMessage,
} from '@/templates/error-handling.template';

test('handles 404 error gracefully', async ({ page }) => {
  await errorHandlingTemplate(page, {
    url: '/non-existent-page',
    expectedStatus: 404,
    expectedErrorIndicators: {
      visible: ['[data-testid="error-page"]', '[data-testid="error-icon"]'],
      hidden: ['[data-testid="main-content"]'],
    },
    expectedText: /Page not found|404/i,
    expectedErrorCode: '404',
    expectedErrorMessage: /The page you requested does not exist/i,
    checkAccessibility: true,
    checkContrast: true,
    recoveryAction: {
      actionSelector: '[data-testid="go-home-button"]',
      expectedUrl: '/',
      expectedSuccess: 'Home',
    },
  });

  // Get error details
  const errorDetails = await getErrorDetails(page);
  console.log('Status Code:', errorDetails.statusCode);
  console.log('Error Message:', errorDetails.errorMessage);
  console.log('Has Recovery Action:', errorDetails.hasRecoveryAction);
});

test('handles network error', async ({ page }) => {
  await page.goto('/dashboard');

  // Trigger network error
  await triggerNetworkError(page, '**/api/data');

  // Attempt to load data
  await page.click('[data-testid="refresh-button"]');

  // Verify error is shown
  await expectErrorMessage(page, 'Network error occurred');
});
```

**API**:

```typescript
interface ErrorHandlingConfig {
  url: string;
  expectedStatus?: number;
  expectedErrorIndicators?: ErrorIndicators;
  expectedText?: string | RegExp;
  expectedErrorCode?: string;
  expectedErrorMessage?: string | RegExp;
  errorBoundarySelector?: string;
  recoveryAction?: ErrorRecoveryConfig;
  checkAccessibility?: boolean;
  checkContrast?: boolean;
  onError?: (page: Page, error: Error) => Promise<void>;
  interceptNetworkErrors?: boolean;
}
```

---

## Helper Functions

### Common Fixtures (`helpers/common-fixtures.ts`)

Reusable utilities for all templates:

```typescript
import {
  TEST_USERS,
  TEST_DATA,
  COMMON_SELECTORS,
  fillForm,
  getElementText,
  mockAPI,
  setLocalStorage,
  getLocalStorage,
  setCookie,
  getCookie,
  checkPageAccessibility,
  takeScreenshot,
  measurePageLoadTime,
  getWebVitals,
} from '@/helpers/common-fixtures';

test('example with common fixtures', async ({ page }) => {
  // Use test data
  const { email, password } = TEST_USERS.user;

  // Fill form using common selector
  await fillForm(page, {
    'input[name="email"]': email,
    'input[name="password"]': password,
  });

  // Mock API response
  await mockAPI(page, '**/api/user/profile', { name: 'John Doe' });

  // Set local storage
  await setLocalStorage(page, 'settings', JSON.stringify({ theme: 'dark' }));

  // Check accessibility
  const a11yIssues = await checkPageAccessibility(page);
  console.log('Accessibility issues:', a11yIssues);

  // Take screenshot
  await takeScreenshot(page, 'dashboard');

  // Get page load metrics
  const loadTime = await measurePageLoadTime(page);
  console.log('Page load time:', loadTime, 'ms');

  // Get Web Vitals
  const vitals = await getWebVitals(page);
  console.log('CLS:', vitals.CLS, 'LCP:', vitals.LCP, 'FID:', vitals.FID);
});
```

### Test Setup (`helpers/test-setup.ts`)

Setup and teardown utilities:

```typescript
import {
  TEST_CONFIG,
  setupTestPage,
  setupAuthentication,
  setupMockAPIs,
  setupErrorHandling,
  cleanupTest,
  waitForImagesToLoad,
  injectTestUtils,
} from '@/helpers/test-setup';

test.beforeEach(async ({ page }) => {
  // Setup page with common config
  await setupTestPage(page, {
    clearStorage: true,
    setViewport: { width: 1280, height: 720 },
  });

  // Setup authentication
  await setupAuthentication(page, 'test-token-123', {
    storageKey: 'auth_token',
    headerName: 'Authorization',
  });

  // Setup mock APIs
  await setupMockAPIs(page, [
    {
      pattern: '**/api/user',
      response: { name: 'Test User' },
      status: 200,
    },
  ]);

  // Setup error handling
  const errors = await setupErrorHandling(page, {
    captureConsoleErrors: true,
    capturePageErrors: true,
    captureNetworkErrors: true,
  });

  // Inject test utilities
  await injectTestUtils(page);
});

test.afterEach(async ({ page }, testInfo) => {
  // Cleanup after test
  await cleanupTest(page, page.context());
});

test('example test', async ({ page }) => {
  await page.goto('/dashboard');
  await waitForImagesToLoad(page);
  // ... rest of test
});
```

---

## Best Practices

### 1. Use Meaningful Selectors

Use data-testid attributes for reliable selectors:

```typescript
// Good
'[data-testid="submit-button"]'

// Avoid
'button:nth-child(2)'
'.primary-btn'
```

### 2. Organize Tests by Feature

```
tests/
  ├── templates/           # Template library
  ├── helpers/             # Helper functions
  ├── e2e/
  │   ├── auth.spec.ts     # Authentication tests
  │   ├── forms.spec.ts    # Form tests
  │   ├── dashboard.spec.ts # Dashboard tests
  │   └── responsiveness.spec.ts
  ├── fixtures/            # Test data
  └── TEMPLATE_USAGE_GUIDE.md
```

### 3. Use Test Data Factories

```typescript
function createTestUser(overrides?: Partial<User>): User {
  return {
    email: 'test@example.com',
    password: 'password123',
    ...overrides,
  };
}

test('create user', async ({ page }) => {
  const user = createTestUser({ email: 'custom@example.com' });
  // ...
});
```

### 4. Avoid Hard-Coded Waits

```typescript
// Bad
await page.waitForTimeout(2000);

// Good
await page.waitForSelector('[data-testid="content"]');
await page.waitForLoadState('networkidle');
```

### 5. Use Hooks for Common Setup

```typescript
test.beforeEach(async ({ page }) => {
  await setupTestPage(page);
  await page.goto('/');
});

test.afterEach(async ({ page }) => {
  await page.context().clearCookies();
});
```

### 6. Group Related Tests

```typescript
test.describe('Dashboard', () => {
  test.describe('Page Load', () => {
    test('loads with all elements', async ({ page }) => {
      // ...
    });

    test('shows loading state', async ({ page }) => {
      // ...
    });
  });

  test.describe('Responsive Design', () => {
    test('works on mobile', async ({ page }) => {
      // ...
    });
  });
});
```

---

## Common Patterns

### Testing with Authentication

```typescript
test('authenticated user flow', async ({ page }) => {
  await setupAuthentication(page, 'auth-token-123');
  await page.goto('/dashboard');
  // ...
});
```

### Testing with Mocked APIs

```typescript
test('dashboard with mocked data', async ({ page }) => {
  await setupMockAPIs(page, [
    { pattern: '**/api/user', response: { name: 'Test User' } },
    { pattern: '**/api/items', response: { items: [] } },
  ]);
  await page.goto('/dashboard');
  // ...
});
```

### Testing Error Scenarios

```typescript
test('shows error when API fails', async ({ page }) => {
  await mockAPI(page, '**/api/data', { error: 'Server error' }, 500);
  await page.goto('/');
  await page.click('[data-testid="load-data"]');
  await expectErrorMessage(page, 'Server error');
});
```

### Testing Accessibility

```typescript
test('page is accessible', async ({ page }) => {
  await page.goto('/');
  const a11yIssues = await checkPageAccessibility(page);
  expect(a11yIssues).toEqual([]);
});
```

---

## Troubleshooting

### Common Issues

**Q: Template times out waiting for element**
```typescript
// Increase timeout
await pageLoadTemplate(page, {
  url: '/',
  maxLoadTime: 5000, // Increased from default 3000
});
```

**Q: Form field not filling**
```typescript
// Clear field first and try again
const field = page.locator('input[name="email"]');
await field.click();
await field.clear();
await field.fill('test@example.com');
```

**Q: Screenshot comparison fails**
```typescript
// Use --update-snapshots flag to update baseline
npx playwright test --update-snapshots
```

**Q: Flaky tests**
```typescript
// Use retry helper
await retryTest(async () => {
  await formSubmissionTemplate(page, config);
}, { maxRetries: 3, delayMs: 1000 });
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run specific template tests
npm test -- page-load.spec.ts
npm test -- form-submission.spec.ts

# Run with UI mode
npm test -- --ui

# Run with headed browser
npm test -- --headed

# Run in debug mode
npm test -- --debug

# Update snapshots
npm test -- --update-snapshots

# Generate coverage report
npm test -- --coverage
```

---

## Next Steps

1. **Integrate with CI/CD**: Add tests to your pipeline
2. **Set Coverage Goals**: Aim for 80%+ coverage
3. **Monitor Performance**: Track load times and metrics
4. **Train Team**: Teach developers to use templates
5. **Expand Templates**: Add custom templates for your app

---

## Support

- Documentation: See individual template files for detailed API docs
- Issues: Report issues in JIRA or GitHub
- Questions: Ask in #qa-automation Slack channel

---

Last Updated: November 2025
