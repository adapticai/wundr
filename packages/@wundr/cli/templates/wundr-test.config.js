/**
 * Wundr Test Configuration
 * Customize the portable test suite for your application
 */

module.exports = {
  // Base URL of your application
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  
  // Test execution settings
  timeout: 30000,
  retries: 2,
  workers: 4,
  
  // Browser settings
  headless: true,
  slowMo: 0,
  
  // Screenshot and video settings
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'on-first-retry',
  
  // Custom selectors for your app
  selectors: {
    navigation: 'nav, [role="navigation"]',
    mainContent: 'main, [role="main"]',
    footer: 'footer',
    searchInput: 'input[type="search"]',
    loginButton: 'button[type="submit"]'
  },
  
  // API configuration
  api: {
    baseURL: process.env.API_BASE_URL || 'http://localhost:3000/api',
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 10000
  },
  
  // Test data
  testData: {
    validUser: {
      username: 'test@example.com',
      password: 'password123'
    },
    searchTerms: ['dashboard', 'settings', 'profile']
  },
  
  // Specific test suites to run
  testSuites: {
    smoke: true,
    accessibility: true,
    api: true,
    performance: true,
    security: false
  },
  
  // Custom test patterns
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts'
  ],
  
  // Reporters
  reporters: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  
  // Projects/browsers to test
  projects: [
    {
      name: 'chromium',
      use: { 
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 }
      }
    },
    {
      name: 'firefox',
      use: { 
        browserName: 'firefox',
        viewport: { width: 1280, height: 720 }
      }
    },
    {
      name: 'webkit',
      use: { 
        browserName: 'webkit',
        viewport: { width: 1280, height: 720 }
      }
    },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      }
    }
  ],
  
  // Hooks
  beforeAll: async () => {
    // Test suite initialization
  },
  
  afterAll: async () => {
    // Test suite cleanup
  }
};