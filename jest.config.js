/** @type {import('jest').Config} */
module.exports = {
  // Test environment
  testEnvironment: 'node',

  // TypeScript support
  preset: 'ts-jest',

  // Root directory
  rootDir: '.',

  // Test match patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts'
  ],

  // Module paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/scripts/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
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

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
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

  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/'
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

  // Max concurrent tests
  maxConcurrency: 5,

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html-report',
        filename: 'report.html',
        expand: true
      }
    ]
  ],

  // Watch mode configuration
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/.git/'
  ]
};