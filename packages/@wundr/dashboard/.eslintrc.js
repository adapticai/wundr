module.exports = {
  root: true,
  extends: ['../../../config/eslint-config/nextjs.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  globals: {
    WebSocket: 'readonly',
    CloseEvent: 'readonly',
    MessageEvent: 'readonly',
    NodeJS: 'readonly',
    requestAnimationFrame: 'readonly',
    window: 'readonly',
    document: 'readonly',
  },
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
  ignorePatterns: [
    'dist/',
    'build/',
    '.next/',
    'coverage/',
    'node_modules/',
    '*.min.js',
  ],
};