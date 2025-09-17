module.exports = {
  root: true,
  extends: ['./config/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  env: {
    node: true,
  },
  ignorePatterns: [
    'dist/',
    'build/',
    'coverage/',
    'node_modules/',
    '*.min.js',
    '.next/',
    'tools/web-client/',
    'packages/@wundr/dashboard/',
    'packages/web-client/',
  ],
  overrides: [
    {
      files: ['scripts/**/*', 'tools/**/*'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  ],
};