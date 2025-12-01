/**
 * Portable test configuration
 * Can be customized via wundr-test.config.js in the target project
 */

export interface TestConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  headless: boolean;
  slowMo?: number;
  screenshot: 'off' | 'on' | 'only-on-failure';
  video: 'off' | 'on' | 'retain-on-failure';
  trace: 'off' | 'on' | 'on-first-retry';

  // Custom selectors for specific apps
  selectors?: {
    navigation?: string;
    mainContent?: string;
    footer?: string;
    searchInput?: string;
    loginButton?: string;
  };

  // API configuration
  api?: {
    baseURL?: string;
    headers?: Record<string, string>;
    timeout?: number;
  };

  // Test data
  testData?: {
    validUser?: {
      username: string;
      password: string;
    };
    searchTerms?: string[];
  };
}

export const defaultConfig: TestConfig = {
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  retries: 2,
  headless: true,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'on-first-retry',

  selectors: {
    navigation: 'nav, [role="navigation"], header',
    mainContent: 'main, [role="main"], #content',
    footer: 'footer, [role="contentinfo"]',
    searchInput: 'input[type="search"], input[placeholder*="search" i]',
    loginButton:
      'button[type="submit"], button:has-text("Login"), button:has-text("Sign in")',
  },

  api: {
    timeout: 10000,
  },
};

/**
 * Load configuration from project or use defaults
 */
export function loadConfig(customConfig?: Partial<TestConfig>): TestConfig {
  return {
    ...defaultConfig,
    ...customConfig,
    selectors: {
      ...defaultConfig.selectors,
      ...customConfig?.selectors,
    },
    api: {
      ...defaultConfig.api,
      ...customConfig?.api,
    },
    testData: {
      ...defaultConfig.testData,
      ...customConfig?.testData,
    },
  };
}
