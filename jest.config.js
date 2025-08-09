/** @type {import('jest').Config} */
module.exports = {
  // Test environment
  testEnvironment: 'node',

  // TypeScript support
  preset: 'ts-jest',

  // Root directory
  rootDir: '.',

  // Test match patterns - Include all test types EXCEPT e2e (Playwright)
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts', 
    '<rootDir>/tests/performance/**/*.test.ts',
    '<rootDir>/tests/quality-gates/**/*.test.ts',
    '<rootDir>/packages/**/tests/**/*.test.ts'
  ],

  // Module paths - Enhanced mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/scripts/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1'
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/utilities/jest.setup.ts'
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],

  // Collect coverage from these files
  collectCoverageFrom: [
    'scripts/**/*.ts',
    '!scripts/**/*.d.ts',
    '!scripts/**/index.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.test.ts',
    '!**/*.spec.ts'
  ],

  // Coverage thresholds - Enhanced for comprehensive testing
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Specific thresholds for critical files
    'scripts/analysis/enhanced-ast-analyzer.ts': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    'scripts/consolidation/consolidation-manager.ts': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'scripts/standardization/pattern-standardizer.ts': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'scripts/governance/governance-system.ts': {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },

  // Transform configuration
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  // File extensions to process
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Test timeout
  testTimeout: 30000,

  // Ignore patterns - Exclude Playwright tests
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/packages/**/tests/e2e/'
  ],

  // Module paths to ignore for transforms
  transformIgnorePatterns: [
    'node_modules/(?!(ts-morph|@typescript-eslint)/)',
  ],

  // Globals for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: {
        target: 'es2020',
        module: 'commonjs',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        skipLibCheck: true,
        strict: true,
        resolveJsonModule: true
      }
    }
  },

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Detect open handles
  detectOpenHandles: true,

  // Force exit after tests complete
  forceExit: false,

  // Max concurrent tests - Optimized for performance
  maxConcurrency: 10,

  // Reporter configuration
  reporters: [
    'default'
  ],

  // Watch mode configuration
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/.git/'
  ]
};