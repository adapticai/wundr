# Playwright Test Template Library

Complete reference guide for Playwright test templates and helpers in Neolith testing.

## What's New

A professional-grade test template library has been created to accelerate Playwright test automation:

### Created Files

```
tests/
├── templates/
│   ├── page-load.template.ts              # Page load validation
│   ├── form-submission.template.ts        # Form testing
│   ├── responsive-breakpoints.template.ts # Responsive design
│   ├── empty-state.template.ts            # Empty state UIs
│   ├── skeleton-loader.template.ts        # Loading states
│   ├── theme-switching.template.ts        # Theme switching
│   └── error-handling.template.ts         # Error pages
│
├── helpers/
│   ├── common-fixtures.ts                 # Common utilities
│   └── test-setup.ts                      # Setup/teardown
│
├── e2e/
│   ├── example-dashboard.spec.ts          # Dashboard example
│   ├── example-form.spec.ts               # Form example
│   └── [your-tests].spec.ts
│
├── index.ts                               # Main exports
├── TEMPLATE_USAGE_GUIDE.md                # Detailed documentation
└── PLAYWRIGHT_TEMPLATES.md                # This file
```

## Quick Reference

### 1. Page Load Template

**Purpose**: Validate page load performance and rendering

**Import**:
```typescript
import { pageLoadTemplate, getPageLoadMetrics } from '@/tests';
```

**Usage**:
```typescript
test('dashboard loads', async ({ page }) => {
  await pageLoadTemplate(page, {
    url: '/dashboard',
    expectedTitle: 'Dashboard',
    expectedElements: ['[data-testid="header"]'],
    maxLoadTime: 3000,
  });
});
```

**Checks**:
- Navigation succeeds (< 400 status)
- Page title matches
- Critical elements are visible
- Load time within budget
- No JavaScript errors
- No 404/500 responses

### 2. Form Submission Template

**Purpose**: Test form validation and submission

**Import**:
```typescript
import { formSubmissionTemplate, clearForm } from '@/tests';
```

**Usage**:
```typescript
test('contact form submits', async ({ page }) => {
  await formSubmissionTemplate(page, {
    formSelector: 'form[data-testid="contact"]',
    fields: [
      { selector: 'input[name="email"]', value: 'test@example.com' },
      { selector: 'textarea[name="message"]', value: 'Hello' },
    ],
    submitButtonSelector: 'button[type="submit"]',
    expectedSuccessIndicator: '[data-testid="success"]',
    expectSuccess: true,
  });
});
```

**Supports**:
- Text, email, password, number inputs
- Checkboxes, radio buttons
- Select dropdowns
- Textareas
- Validation rules
- Error handling
- Before/after hooks

### 3. Responsive Breakpoints Template

**Purpose**: Test responsive design across devices

**Import**:
```typescript
import { responsiveBreakpointsTemplate } from '@/tests';
```

**Usage**:
```typescript
test('responsive layout', async ({ page }) => {
  await responsiveBreakpointsTemplate(page, {
    url: '/dashboard',
    breakpoints: ['mobile', 'tablet', 'desktop'],
    elementVisibility: {
      mobile: {
        visible: ['[data-testid="mobile-nav"]'],
        hidden: ['[data-testid="sidebar"]'],
      },
      desktop: {
        visible: ['[data-testid="sidebar"]'],
        hidden: ['[data-testid="mobile-nav"]'],
      },
    },
    checkTextReadability: true,
    checkTouchTargets: true,
  });
});
```

**Built-in Breakpoints**:
- `mobile`: 375x667
- `tablet`: 768x1024
- `desktop`: 1280x720
- `wide`: 1920x1080

**Checks**:
- Layout shift (CLS)
- Text readability
- Touch target sizes (44x44px)
- Font sizes
- Line heights

### 4. Empty State Template

**Purpose**: Verify empty state displays

**Import**:
```typescript
import { emptyStateTemplate, getEmptyStateContent } from '@/tests';
```

**Usage**:
```typescript
test('shows empty state', async ({ page }) => {
  await emptyStateTemplate(page, {
    url: '/items?empty=true',
    emptyIndicators: {
      visible: ['[data-testid="empty-state"]'],
      hidden: ['[data-testid="items-list"]'],
    },
    expectedText: /No items found/i,
    expectedCTA: {
      selector: '[data-testid="create-button"]',
      expectedText: /Create item/i,
    },
  });
});
```

**Checks**:
- Empty state elements visible
- Data elements hidden
- Appropriate messaging
- Call-to-action available
- Accessibility
- Contrast ratios

### 5. Skeleton Loader Template

**Purpose**: Test loading states and skeleton screens

**Import**:
```typescript
import { skeletonLoaderTemplate, measureSkeletonTransitionTime } from '@/tests';
```

**Usage**:
```typescript
test('shows skeleton while loading', async ({ page }) => {
  await skeletonLoaderTemplate(page, {
    url: '/dashboard',
    skeletonSelectors: ['[data-testid="card-skeleton"]'],
    contentSelectors: ['[data-testid="card"]'],
    shouldShow: 'both',
    transitionTimeout: 5000,
    checkAnimations: true,
  });

  // Measure transition time
  const time = await measureSkeletonTransitionTime(
    page,
    '[data-testid="card-skeleton"]',
    '[data-testid="card"]'
  );
  console.log('Load time:', time, 'ms');
});
```

**Checks**:
- Skeleton appears during load
- Animations are present
- Content appears after load
- Skeleton disappears
- Accessibility
- Transition timing

### 6. Theme Switching Template

**Purpose**: Test theme switching and persistence

**Import**:
```typescript
import { themeSwitchingTemplate, getCurrentTheme } from '@/tests';
```

**Usage**:
```typescript
test('theme switching works', async ({ page }) => {
  await themeSwitchingTemplate(page, {
    url: '/dashboard',
    themeToggleSelector: '[data-testid="theme-toggle"]',
    themes: ['light', 'dark'],
    persistenceEnabled: true,
    persistenceKey: 'theme',
    checkContrast: true,
    checkFontLegibility: true,
  });

  // Get current theme
  const theme = await getCurrentTheme(page, 'theme');
  console.log('Current theme:', theme);
});
```

**Checks**:
- Theme switching works
- Colors applied correctly
- Persistence works
- Contrast ratios adequate
- Font legibility
- CSS variables set

### 7. Error Handling Template

**Purpose**: Test error pages and recovery

**Import**:
```typescript
import { errorHandlingTemplate, triggerNetworkError } from '@/tests';
```

**Usage**:
```typescript
test('handles 404 error', async ({ page }) => {
  await errorHandlingTemplate(page, {
    url: '/non-existent',
    expectedStatus: 404,
    expectedText: /Page not found/i,
    expectedErrorCode: '404',
    checkAccessibility: true,
    recoveryAction: {
      actionSelector: '[data-testid="go-home"]',
      expectedUrl: '/',
    },
  });
});

test('handles network error', async ({ page }) => {
  await triggerNetworkError(page, '**/api/data');
  // ... test error handling
});
```

**Checks**:
- Error page displays
- Error message visible
- Error code shown
- Accessibility
- Recovery action available
- Recovery action works

## Helper Functions

### Test Setup

```typescript
import { setupTestPage, setupAuthentication, setupMockAPIs } from '@/tests';

test.beforeEach(async ({ page }) => {
  // Setup page
  await setupTestPage(page, {
    clearStorage: true,
    setViewport: { width: 1280, height: 720 },
  });

  // Setup auth
  await setupAuthentication(page, 'auth-token', {
    storageKey: 'auth_token',
    headerName: 'Authorization',
  });

  // Mock APIs
  await setupMockAPIs(page, [
    {
      pattern: '**/api/user',
      response: { name: 'Test User' },
      status: 200,
    },
  ]);
});
```

### Common Utilities

```typescript
import {
  fillForm,
  mockAPI,
  setLocalStorage,
  getCookie,
  checkPageAccessibility,
  measurePageLoadTime,
  getWebVitals,
} from '@/tests';

// Fill form
await fillForm(page, {
  'input[name="email"]': 'test@example.com',
  'input[name="password"]': 'password123',
});

// Mock API
await mockAPI(page, '**/api/data', { data: [] }, 200);

// Local storage
await setLocalStorage(page, 'settings', JSON.stringify({ theme: 'dark' }));

// Cookies
const sessionCookie = await getCookie(page, 'session');

// Accessibility
const a11yIssues = await checkPageAccessibility(page);

// Performance
const loadTime = await measurePageLoadTime(page);
const vitals = await getWebVitals(page); // CLS, LCP, FID
```

## Test Structure Examples

### Complete Dashboard Test

```typescript
import { test } from '@playwright/test';
import {
  pageLoadTemplate,
  responsiveBreakpointsTemplate,
  setupTestPage,
  setupAuthentication,
  setupMockAPIs,
} from '@/tests';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestPage(page);
    await setupAuthentication(page, 'token-123');
    await setupMockAPIs(page, [
      {
        pattern: '**/api/dashboard',
        response: { cards: [...] },
      },
    ]);
  });

  test('loads with all elements', async ({ page }) => {
    await pageLoadTemplate(page, {
      url: '/dashboard',
      expectedTitle: 'Dashboard',
      expectedElements: ['[data-testid="cards"]'],
    });
  });

  test('is responsive', async ({ page }) => {
    await responsiveBreakpointsTemplate(page, {
      url: '/dashboard',
      breakpoints: ['mobile', 'desktop'],
      elementVisibility: {
        mobile: { visible: ['[data-testid="mobile-nav"]'] },
        desktop: { visible: ['[data-testid="sidebar"]'] },
      },
    });
  });
});
```

### Form Validation Test

```typescript
test('form validation works', async ({ page }) => {
  await page.goto('/contact');

  await formSubmissionTemplate(page, {
    formSelector: 'form[data-testid="contact"]',
    fields: [
      { selector: 'input[name="email"]', value: 'invalid' },
    ],
    submitButtonSelector: 'button',
    validationRules: [
      {
        fieldSelector: 'input[name="email"]',
        expectedErrorSelector: '[data-testid="email-error"]',
        expectedErrorMessage: /valid email/i,
      },
    ],
    expectSuccess: false,
  });
});
```

### Error Handling Test

```typescript
test('shows error when API fails', async ({ page, context }) => {
  await context.route('**/api/data', (route) => {
    route.fulfill({ status: 500 });
  });

  await errorHandlingTemplate(page, {
    url: '/page',
    expectedStatus: 500,
    expectedText: /error occurred/i,
  });
});
```

## Best Practices

### Selector Strategy

**Use data-testid** (best):
```typescript
'[data-testid="submit-button"]'
```

**Avoid** (brittle):
```typescript
'.btn-primary'
'button:nth-child(2)'
'button.btn-primary.is-active'
```

### Test Names

**Good** (descriptive):
```typescript
test('login form submits with valid email and password', async ({ page }) => {
```

**Bad** (vague):
```typescript
test('login form', async ({ page }) => {
```

### Setup Pattern

**Good** (isolated):
```typescript
test.beforeEach(async ({ page }) => {
  await setupTestPage(page);
  await clearLocalStorage(page);
  await clearCookies(page);
});
```

**Bad** (coupling):
```typescript
// Relying on previous test state
```

### Waiting Strategy

**Good** (explicit):
```typescript
await page.waitForSelector('[data-testid="content"]');
await expect(element).toBeVisible();
```

**Bad** (implicit):
```typescript
await page.waitForTimeout(2000);
```

## Running Tests

```bash
# All tests
npm test

# Specific file
npm test -- dashboard.spec.ts

# Specific test pattern
npm test -- -g "loads page"

# With UI
npm test -- --ui

# Debug
npm test -- --debug

# Headed (see browser)
npm test -- --headed

# Update snapshots
npm test -- --update-snapshots

# Coverage
npm test -- --coverage
```

## Troubleshooting

### Test Timeout

**Problem**: Test times out waiting for element

**Solution**:
```typescript
// Increase timeout
await pageLoadTemplate(page, {
  url: '/',
  maxLoadTime: 5000, // was 3000
});

// Or debug what's happening
await page.pause(); // Opens Playwright Inspector
```

### Element Not Found

**Problem**: Selector doesn't match

**Solution**:
```typescript
// Debug selector
await page.click('button'); // Try broad selector first
const element = page.locator('[data-testid="button"]');
console.log(await element.count()); // Check if element exists
```

### Flaky Tests

**Problem**: Test sometimes passes, sometimes fails

**Solution**:
```typescript
// Use retry helper
import { retryTest } from '@/tests';

await retryTest(async () => {
  await formSubmissionTemplate(page, config);
}, { maxRetries: 3, delayMs: 1000 });
```

### Form Not Submitting

**Problem**: Form submission fails

**Solution**:
```typescript
// Check form state before submit
const form = page.locator('form[data-testid="form"]');
const isSubmitDisabled = await form.locator('button[type="submit"]').isDisabled();
console.log('Submit disabled:', isSubmitDisabled);

// Check for validation errors
const errors = await form.locator('[class*="error"]').all();
console.log('Validation errors:', errors.length);
```

## Performance Targets

Recommended thresholds for Neolith:

| Metric | Target | Critical |
|--------|--------|----------|
| Page Load | < 3s | < 5s |
| Time to Interactive | < 4s | < 6s |
| Form Submission | < 2s | < 5s |
| Cumulative Layout Shift | < 0.1 | < 0.25 |
| Touch Target Size | >= 44px | >= 24px |
| Text Font Size | >= 12px | >= 10px |

## Integration with CI/CD

### GitHub Actions

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build
      - run: npm test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: test-results/
```

## API Reference Quick Links

For detailed API documentation, see:
- **[TEMPLATE_USAGE_GUIDE.md](./TEMPLATE_USAGE_GUIDE.md)** - Complete API reference
- **[example-dashboard.spec.ts](./e2e/example-dashboard.spec.ts)** - Full examples
- **[index.ts](./index.ts)** - Export reference

## Next Steps

1. **Review Examples**: Check `e2e/example-*.spec.ts` files
2. **Read Full Guide**: See `TEMPLATE_USAGE_GUIDE.md`
3. **Create First Test**: Use a template with your app
4. **Add to CI/CD**: Integrate with GitHub Actions
5. **Expand Coverage**: Add more tests using templates

## Support

- **Questions**: Check TEMPLATE_USAGE_GUIDE.md
- **Issues**: Report in JIRA
- **Slack**: #qa-automation channel
- **Examples**: See e2e/ directory

---

**Version**: 1.0.0
**Last Updated**: November 2025
**Maintained By**: Quality Engineering Team
