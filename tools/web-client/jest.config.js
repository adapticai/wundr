const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Handle module aliases
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  testMatch: [
    '<rootDir>/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/components/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/lib/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/hooks/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/app/**/*.test.{js,jsx,ts,tsx}',
  ],
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/*.config.js',
    '!**/*.config.ts',
    '!**/__tests__/**',
    '!**/fixtures/**',
    '!**/setup/**',
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    // Use babel-jest to transpile tests with the next/babel preset
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(chart\\.js|d3|@testing-library)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  testTimeout: 10000,
  maxWorkers: '50%',
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/coverage/',
  ],
  // Global setup and teardown
  globalSetup: '<rootDir>/__tests__/setup/global-setup.js',
  globalTeardown: '<rootDir>/__tests__/setup/global-teardown.js',
  // Error handling
  bail: false,
  verbose: true,
  // Memory management
  workerIdleMemoryLimit: '512MB',
}

module.exports = createJestConfig(customJestConfig)