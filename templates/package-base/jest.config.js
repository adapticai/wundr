const baseConfig = require('@wundr/jest-config');

module.exports = {
  ...baseConfig,
  displayName: '{{PACKAGE_NAME}}',
  rootDir: '.',
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.spec.ts'
  ]
};