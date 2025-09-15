# Portable UI Testing Framework

The Wundr CLI now includes a powerful, portable UI testing framework that can be used in any
repository where `@wundr.io/cli` is installed.

## Features

- **Portable Test Suites**: Bundled test suites that work with any web application
- **Multiple Test Types**: UI, API, and unit test support
- **Cross-Browser Testing**: Test on Chromium, Firefox, WebKit, and mobile devices
- **Accessibility Testing**: Built-in WCAG compliance checks
- **Configuration**: Customizable test configuration for your specific application
- **CI/CD Ready**: Automatic GitHub Actions workflow generation

## Installation

When you install the Wundr CLI in any project, the testing framework is included:

```bash
npm install -D @wundr.io/cli
# or
yarn add -D @wundr.io/cli
# or
pnpm add -D @wundr.io/cli
```

## Quick Start

### 1. Initialize Test Configuration

```bash
npx wundr test init
```

This interactive wizard will:

- Ask for your application's base URL
- Let you choose which test suites to enable
- Select browsers to test
- Generate a `wundr-test.config.js` file
- Add test scripts to your `package.json`
- Optionally create GitHub Actions workflow

### 2. Run Tests

```bash
# Run all tests
npx wundr test

# Run specific test types
npx wundr test --type ui
npx wundr test --type api
npx wundr test --type unit

# Run in specific browser
npx wundr test --browser chromium
npx wundr test --browser firefox

# Run in headed mode (visible browser)
npx wundr test --headed

# Specify custom base URL
npx wundr test --base-url http://localhost:4000

# Open HTML report after tests
npx wundr test --report

# Run in watch mode (interactive UI)
npx wundr test --watch
```

## Bundled Test Suites

### UI Tests

- **Smoke Tests**: Basic functionality validation
- **Accessibility Tests**: WCAG compliance checks
- **Navigation Tests**: Link and routing validation
- **Performance Tests**: Loading time and responsiveness
- **Mobile Tests**: Responsive design validation

### API Tests

- **Health Checks**: Endpoint availability
- **Response Validation**: Content type and structure
- **Error Handling**: Graceful error responses
- **Performance**: Response time validation
- **Security Headers**: CORS and security validation

## Configuration

The `wundr-test.config.js` file allows you to customize:

```javascript
module.exports = {
  // Base URL of your application
  baseURL: 'http://localhost:3000',

  // Test execution settings
  timeout: 30000,
  retries: 2,
  workers: 4,

  // Browser settings
  headless: true,

  // Custom selectors for your app
  selectors: {
    navigation: 'nav, [role="navigation"]',
    mainContent: 'main, [role="main"]',
    footer: 'footer',
    searchInput: 'input[type="search"]',
    loginButton: 'button[type="submit"]',
  },

  // API configuration
  api: {
    baseURL: 'http://localhost:3000/api',
    headers: {
      'Content-Type': 'application/json',
    },
  },

  // Test data
  testData: {
    validUser: {
      username: 'test@example.com',
      password: 'password123',
    },
    searchTerms: ['dashboard', 'settings', 'profile'],
  },

  // Specific test suites to run
  testSuites: {
    smoke: true,
    accessibility: true,
    api: true,
    performance: false,
    security: false,
  },
};
```

## Use Cases

### 1. Testing Wundr Dashboard

```bash
npx wundr test --base-url http://localhost:3001 --type ui
```

### 2. Testing Web Client

```bash
npx wundr test --base-url http://localhost:3000 --type ui
```

### 3. Testing API Endpoints

```bash
npx wundr test --base-url http://localhost:3000 --type api
```

### 4. CI/CD Pipeline Testing

```yaml
# .github/workflows/wundr-tests.yml
name: Wundr Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:wundr
```

## Benefits

1. **Zero Configuration**: Works out of the box with sensible defaults
2. **Framework Agnostic**: Tests work with any web framework (React, Vue, Angular, etc.)
3. **Portable**: Same tests can run locally and in CI/CD
4. **Comprehensive**: Covers UI, API, accessibility, and performance
5. **Customizable**: Easily adapt to your application's specific needs
6. **Maintained**: Test suites are updated with each Wundr release

## Example Output

```
🧪 Running UI Tests...
  ✓ homepage loads without errors (1.2s)
  ✓ navigation elements are present (0.8s)
  ✓ interactive elements are clickable (0.5s)
  ✓ forms accept input (0.6s)
  ✓ responsive layout works (1.1s)
  ✓ page has proper metadata (0.3s)

🔌 Running API Tests...
  ✓ health endpoint responds (0.2s)
  ✓ API returns proper content types (0.1s)
  ✓ API handles errors gracefully (0.3s)
  ✓ API responds within acceptable time (0.1s)

✅ All tests passed!
📊 View detailed report: test-results/html/index.html
```

## Advanced Usage

### Custom Test Patterns

Add your own test files alongside the bundled ones:

```javascript
// my-custom-test.spec.ts
import { test, expect } from '@playwright/test';

test('custom business logic', async ({ page }) => {
  await page.goto('/');
  // Your custom test logic
});
```

### Extending Test Configuration

```javascript
// wundr-test.config.js
module.exports = {
  // ... base config ...

  // Add custom test patterns
  testMatch: ['**/*.spec.ts', 'my-tests/**/*.test.js'],

  // Custom reporters
  reporters: [
    ['html', { outputFolder: 'custom-reports' }],
    ['json', { outputFile: 'results.json' }],
    ['junit', { outputFile: 'junit.xml' }],
  ],
};
```

## Troubleshooting

### Tests fail with "No tests found"

- Ensure Playwright is installed: `npm install -D @playwright/test`
- Check that test suites are enabled in `wundr-test.config.js`

### Browser not launching

- Install browser dependencies: `npx playwright install --with-deps`

### Custom selectors not working

- Update the `selectors` section in `wundr-test.config.js`
- Use browser DevTools to find correct selectors

## Future Enhancements

- Visual regression testing
- Performance budgets
- Security scanning
- Load testing
- E2E user journey tests
- Integration with Wundr dashboard for test results visualization

## Contributing

The portable testing framework is part of the Wundr CLI package. To contribute:

1. Fork the repository
2. Add tests to `/packages/@wundr/cli/test-suites/`
3. Update documentation
4. Submit a pull request

## License

MIT - Part of the Wundr platform
